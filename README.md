# Wayfront CLI

Work with your [Wayfront](https://wayfront.com) workspace from the terminal.

It now has first-class resource commands for the API, plus one raw escape hatch.

## Install

```bash
npx wayfront
```

Or install globally:

```bash
npm install -g wayfront
```

## Connect a workspace

OAuth is the main path:

```bash
wayfront auth login acme
```

That opens your browser, signs you in, and stores an OAuth session locally.

Check what you're connected to:

```bash
wayfront auth status
wayfront workspace list
```

Switch workspaces:

```bash
wayfront workspace use acme
```

## Non-interactive / CI authentication

OAuth needs a browser, which CI does not have. Use an API token instead.

Save a token to the config once:

```bash
wayfront auth token acme --token wf_xxx
# or omit --token to be prompted
```

Or authenticate with no config file at all — set two environment variables and the
CLI uses them for every command:

```bash
export WAYFRONT_TOKEN=wf_xxx
export WAYFRONT_WORKSPACE=acme   # a name, domain, or full URL
wayfront templates pull
```

`WAYFRONT_TOKEN` takes precedence over any saved credentials, so it is the simplest
way to run the CLI in a GitHub Actions job or other automation.

## Resource-first commands

The CLI is organized by resource, similar to `gh`.

Available command groups:

- `auth`
- `workspace`
- `templates`
- `clients`
- `client-activities`
- `coupons`
- `filled-form-fields`
- `invoices`
- `logs`
- `order-messages`
- `order-tasks`
- `orders`
- `services`
- `subscriptions`
- `tags`
- `tasks`
- `team`
- `ticket-messages`
- `tickets`
- `api` as the raw fallback

Examples:

```bash
wayfront orders list
wayfront orders get ord_123
wayfront tickets create --json '{"subject":"Help","message":"Need a hand"}'
wayfront invoices charge inv_123 --json '{"payment_method":"manual"}'
```

Path parameters are positional. Query parameters still use `key=value`:

```bash
wayfront orders list page=2
wayfront ticket-messages list ticket_123 limit=50
```

For request bodies, use `--json`:

```bash
wayfront clients create --json '{"email":"jane@example.com","name":"Jane"}'
wayfront orders update ord_123 --json '{"status":"in_progress"}'
```

## Template workflow

```bash
wayfront templates pull
wayfront templates push
wayfront templates reset
```

Or work on a single template:

```bash
wayfront templates pull portal.home
wayfront templates push portal.home
wayfront templates reset portal.home
```

The `templates/` folder is yours to version control. Pull once, make changes over time, push when ready.

## Raw API escape hatch

The raw API command is still there for anything advanced or newly added:

```bash
wayfront api list
wayfront api list Orders
wayfront api call ordersUpdate order=ord_123 --json '{"status":"paid"}'
```

## Commands

```bash
wayfront                                 Show connection status and help
wayfront auth login [workspace]          Sign in with OAuth
wayfront auth token [workspace]          Save an API token (non-interactive / CI)
wayfront auth status                     Show the active workspace and auth state
wayfront auth logout [workspace]         Remove a saved auth session
wayfront workspace list                  List configured workspaces
wayfront workspace use <workspace>       Switch the active workspace
wayfront templates pull [name]           Pull templates, or one by name
wayfront templates push [name]           Push changed templates, or one by name
wayfront templates reset [name]          Reset modified templates to default
wayfront orders list|get|create|update|delete
wayfront tickets list|get|create|update|delete
wayfront invoices list|get|create|update|delete|charge|mark-paid
wayfront api list [tag]                  List raw API operations from api.yaml
wayfront api call <operationId> [params] Call any raw API operation by operationId
```

Run `wayfront <resource> --help` to see the commands for any specific resource.

## Template naming

Templates use dot-notation that maps to folders:

```bash
portal.invoices.show  →  templates/portal/invoices/show.twig
email.invoice_paid    →  templates/email/invoice_paid.twig
```

## Permissions

OAuth gets you into the app API, but the app still decides what you can do.

Examples:

- workspaces without template access still can't pull or push templates
- staff without `settings_templates` permission still can't access template endpoints
- non-template endpoints can still work through OAuth when the workspace allows them

## Requirements

Node.js 18+
