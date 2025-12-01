# Remote Bindings Guide

## Overview

Remote bindings are bindings that are configured to connect to the deployed, remote resource during local development instead of the locally simulated resource. Remote bindings are supported by Wrangler, the Cloudflare Vite plugin, and the @cloudflare/vitest-pool-workers package.

## Configuration

You can configure remote bindings by setting `remote: true` in the binding definition.

### Example Configuration

```toml
# wrangler.toml
name = "my-worker"
compatibility_date = "2025-11-29"

[[r2_buckets]]
bucket_name = "screenshots-bucket"
binding = "screenshots_bucket"
remote = true
```

When remote bindings are configured, your Worker still executes locally, only the underlying resources your bindings connect to change. For all bindings marked with `remote: true`, Miniflare will route its operations (such as `env.MY_KV.put()`) to the deployed resource. All other bindings not explicitly configured with `remote: true` continue to use their default local simulations.

## Integration with Environments

Remote Bindings work well together with Workers Environments. To protect production data, you can create a development or staging environment and specify different resources in your Wrangler configuration than you would use for production.

### Example Environment Configuration

```toml
# wrangler.toml
name = "my-worker"
compatibility_date = "2025-11-29"

[env.production]
[[env.production.r2_buckets]]
bucket_name = "screenshots-bucket"
binding = "screenshots_bucket"

[env.staging]
[[env.staging.r2_buckets]]
bucket_name = "preview-screenshots-bucket"
binding = "screenshots_bucket"
remote = true
```

Running `wrangler dev -e staging` (or `CLOUDFLARE_ENV=staging vite dev`) with the above configuration means that:

- Your Worker code runs locally
- All calls made to `env.screenshots_bucket` will use the `preview-screenshots-bucket` resource, rather than the production `screenshots-bucket`

## Recommended Remote Bindings

We recommend configuring specific bindings to connect to their remote counterparts. These services often rely on Cloudflare's network infrastructure or have complex backends that are not fully simulated locally.

### Browser Rendering

To interact with a real headless browser for rendering. There is no current local simulation for Browser Rendering.

```toml
[browser]
binding = "MY_BROWSER"
remote = true
```

### Workers AI

To utilize actual AI models deployed on Cloudflare's network for inference. There is no current local simulation for Workers AI.

```toml
[ai]
binding = "AI"
remote = true
```

### Vectorize

To connect to your production Vectorize indexes for accurate vector search and similarity operations. There is no current local simulation for Vectorize.

```toml
[[vectorize]]
binding = "MY_VECTORIZE_INDEX"
index_name = "my-prod-index"
remote = true
```

### mTLS

To verify that the certificate exchange and validation process work as expected. There is no current local simulation for mTLS bindings.

```toml
[[mtls_certificates]]
binding = "MY_CLIENT_CERT_FETCHER"
certificate_id = "<YOUR_UPLOADED_CERT_ID>"
remote = true
```

### Images

To connect to a high-fidelity version of the Images API, and verify that all transformations work as expected. Local simulation for Cloudflare Images is limited with only a subset of features.

```toml
[images]
binding = "IMAGES"
remote = true
```

> **Note:** If `remote: true` is not specified for Browser Rendering, Vectorize, mTLS, or Images, Cloudflare will issue a warning. This prompts you to consider enabling it for a more production-like testing experience.
> 
> If a Workers AI binding has `remote` set to `false`, Cloudflare will produce an error. If the property is omitted, Cloudflare will connect to the remote resource and issue a warning to add the property to configuration.

### Dispatch Namespaces

Workers for Platforms users can configure `remote: true` in dispatch namespace binding definitions:

```toml
[[dispatch_namespaces]]
binding = "DISPATCH_NAMESPACE"
namespace = "testing"
remote = true
```

This allows you to run your dynamic dispatch Worker locally, while connecting it to your remote dispatch namespace binding. This allows you to test changes to your core dispatching logic against real, deployed user Workers.

## Unsupported Remote Bindings

Certain bindings are not supported for remote connections (i.e. with `remote: true`) during local development. These will always use local simulations or local values.

If `remote: true` is specified in Wrangler configuration for any of the following unsupported binding types, Cloudflare will issue an error.

### Always Local Bindings

- **Durable Objects:** Enabling remote connections for Durable Objects may be supported in the future, but currently will always run locally. However, using Durable Objects in combination with remote bindings is possible.
- **Workflows:** Enabling remote connections for Workflows may be supported in the future, but currently will only run locally. However, using Workflows in combination with remote bindings is possible.
- **Environment Variables (vars):** Environment variables are intended to be distinct between local development and deployed environments. They are easily configurable locally (such as in a `.dev.vars` file or directly in Wrangler configuration).
- **Secrets:** Like environment variables, secrets are expected to have different values in local development versus deployed environments for security reasons. Use `.dev.vars` for local secret management.
- **Static Assets:** Static assets are always served from your local disk during development for speed and direct feedback on changes.
- **Version Metadata:** Since your Worker code is running locally, version metadata (like commit hash, version tags) associated with a specific deployed version is not applicable or accurate.
- **Analytics Engine:** Local development sessions typically don't contribute data directly to production Analytics Engine.
- **Hyperdrive:** This is being actively worked on, but is currently unsupported.
- **Rate Limiting:** Local development sessions typically should not share or affect rate limits of your deployed Workers. Rate limiting logic should be tested against local simulations.

> **Note:** If you have use-cases for connecting to any of the remote resources above, please open a feature request in our workers-sdk repository.

## Using Remote Resources with Durable Objects and Workflows

While Durable Object and Workflow bindings cannot currently be remote, you can still use them during local development and have them interact with remote resources.

There are two recommended patterns for this:

### 1. Local Durable Objects/Workflows with Remote Bindings

When you enable remote bindings in your Wrangler configuration, your locally running Durable Objects and Workflows can access remote resources. This allows such bindings, although run locally, to interact with remote resources during local development.

### 2. Accessing Remote Durable Objects/Workflows via Service Bindings

To interact with remote Durable Object or Workflow instances, deploy a Worker that defines those. Then, in your local Worker, configure a remote service binding pointing to the deployed Worker. Your local Worker will be then able to interact with the remote deployed Worker, which in turn can communicate with the remote Durable Objects/Workflows. Using this method, you can create a communication channel via the remote service binding, effectively using the deployed Worker as a proxy interface to the remote bindings during local development.

## Important Considerations

### Data Modification
Operations (writes, deletes, updates) on bindings connected remotely will affect your actual data in the targeted Cloudflare resource (be it preview or production).

### Billing
Interactions with remote Cloudflare services through these connections will incur standard operational costs for those services (such as KV operations, R2 storage/operations, AI requests, D1 usage).

### Network Latency
Expect network latency for operations on these remotely connected bindings, as they involve communication over the internet.

## API

Wrangler provides programmatic utilities to help tooling authors support remote binding connections when running Workers code with Miniflare.

### Key APIs

- `startRemoteProxySession`: Starts a proxy session that allows interaction with remote bindings.
- `unstable_convertConfigBindingsToStartWorkerBindings`: Utility for converting binding definitions.
- `experimental_maybeStartOrUpdateProxySession`: Convenience function to easily start or update a proxy session.

#### startRemoteProxySession

This function starts a proxy session for a given set of bindings. It accepts options to control session behavior, including an auth option with your Cloudflare account ID and API token for remote binding access.

It returns an object with:
- `ready`: Resolves when the session is ready.
- `dispose`: Stops the session.
- `updateBindings`: Updates session bindings.
- `remoteProxyConnectionString`: String to pass to Miniflare for remote binding access.

#### unstable_convertConfigBindingsToStartWorkerBindings

The `unstable_readConfig` utility returns an `Unstable_Config` object which includes the definition of the bindings included in the configuration file. These bindings definitions are however not directly compatible with `startRemoteProxySession`. It can be quite convenient to however read the binding declarations with `unstable_readConfig` and then pass them to `startRemoteProxySession`, so for this wrangler exposes `unstable_convertConfigBindingsToStartWorkerBindings` which is a simple utility to convert the bindings in an `Unstable_Config` object into a structure that can be passed to `startRemoteProxySession`.

> **Note:** This type conversion is temporary. In the future, the types will be unified so you can pass the config object directly to `startRemoteProxySession`.

#### maybeStartOrUpdateRemoteProxySession

This wrapper simplifies proxy session management. It takes:

An object that contains either:
- The path to a Wrangler configuration and a potential target environment
- The name of the Worker and the bindings it is using

The current proxy session details (this parameter can be set to `null` or not being provided if none).

Potentially the auth data to use for the remote proxy session.

It returns an object with the proxy session details if started or updated, or `null` if no proxy session is needed.

The function:
1. Based on the first argument prepares the input arguments for the proxy session.
2. If there are no remote bindings to be used (nor a pre-existing proxy session) it returns `null`, signaling that no proxy session is needed.
3. If the details of an existing proxy session have been provided it updates the proxy session accordingly.
4. Otherwise if starts a new proxy session.
5. Returns the proxy session details (that can later be passed as the second argument to `maybeStartOrUpdateRemoteProxySession`).

### Example

Here's a basic example of using Miniflare with `maybeStartOrUpdateRemoteProxySession` to provide a local dev session with remote bindings. This example uses a single hardcoded KV binding.

```javascript
import { Miniflare, MiniflareOptions } from "miniflare";
import { maybeStartOrUpdateRemoteProxySession } from "wrangler";

let mf: Miniflare | null;
let remoteProxySessionDetails: Awaited<
  ReturnType<typeof maybeStartOrUpdateRemoteProxySession>
> | null = null;

async function startOrUpdateDevSession() {
  remoteProxySessionDetails = await maybeStartOrUpdateRemoteProxySession(
    {
      bindings: {
        MY_KV: {
          type: "kv_namespace",
          id: "kv-id",
          remote: true,
        },
      },
    },
    remoteProxySessionDetails,
  );

  const miniflareOptions: MiniflareOptions = {
    scriptPath: "./worker.js",
    kvNamespaces: {
      MY_KV: {
        id: "kv-id",
        remoteProxyConnectionString:
          remoteProxySessionDetails?.session.remoteProxyConnectionString,
      },
    },
  };

  if (!mf) {
    mf = new Miniflare(miniflareOptions);
  } else {
    mf.setOptions(miniflareOptions);
  }
}

// ... tool logic that invokes `startOrUpdateDevSession()` ...

// ... once the dev session is no longer needed run
// `remoteProxySessionDetails?.session.dispose()`
```

## wrangler dev --remote (Legacy)

Separate from Miniflare-powered local development, Wrangler also offers a fully remote development mode via `wrangler dev --remote`. Remote development is not supported in the Vite plugin.

```bash
npx wrangler dev --remote
```

During remote development, all of your Worker code is uploaded to a temporary preview environment on Cloudflare's infrastructure, and changes to your code are automatically uploaded as you save.

When using remote development, all bindings automatically connect to their remote resources. Unlike local development, you cannot configure bindings to use local simulations - they will always use the deployed resources on Cloudflare's network.

### When to Use Remote Development

For most development tasks, the most efficient and productive experience will be local development along with remote bindings when needed.

You may want to use `wrangler dev --remote` for testing features or behaviors that are highly specific to Cloudflare's network and cannot be adequately simulated locally or tested via remote bindings.

### Considerations

- **Iteration Speed:** Iteration is significantly slower than local development due to the upload/deployment step for each change.
- **Limitations:** When you run a remote development session using the `--remote` flag, a limit of 50 routes per zone is enforced. Learn more in Workers platform limits.

## Best Practices

### Development Workflow

1. **Start with Local Development:** Use `wrangler dev` for most development tasks
2. **Add Remote Bindings as Needed:** Configure `remote: true` for services that require it
3. **Use Staging Environment:** Create a staging environment for testing with remote resources
4. **Protect Production Data:** Never use `remote: true` with production resources during development

### Configuration Management

```toml
# Development environment with remote bindings
[env.dev]
[[env.dev.d1_databases]]
binding = "DB"
database_name = "crypto-intel-dev"
database_id = "dev-database-id"
remote = true

[[env.dev.kv_namespaces]]
binding = "CACHE"
id = "dev-cache-id"
remote = true
```

### Testing Strategy

1. **Unit Tests:** Use local simulations for fast feedback
2. **Integration Tests:** Use remote bindings for realistic testing
3. **E2E Tests:** Use `wrangler dev --remote` for full production-like testing
4. **Performance Tests:** Always test against remote resources for accurate metrics

## Troubleshooting

### Common Issues

1. **Authentication Errors:** Ensure your API token has proper permissions
2. **Network Latency:** Remote bindings will be slower than local simulations
3. **Data Conflicts:** Be careful not to modify production data during development
4. **Configuration Errors:** Double-check binding names and resource IDs

### Debugging

```bash
# Check current configuration
wrangler whoami

# Test remote bindings
wrangler dev --remote

# Monitor logs
wrangler tail
```

## Conclusion

Remote bindings provide a powerful way to develop locally while connecting to production-like resources. When used properly, they enable realistic testing without the overhead of full remote development. Always consider the trade-offs between development speed and production accuracy when configuring your development environment.