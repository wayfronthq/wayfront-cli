# Wayfront CLI

Pull and push Twig templates from your [Wayfront](https://wayfront.com) workspace.

## Install

```
npx wayfront
```

Or install globally:

```
npm install -g wayfront
```

This will walk you through connecting your workspace. Enter your username, grab your API token from the browser, and you're ready to go.

## Workflow

```bash
# 1. Pull templates from your workspace
wayfront templates:pull

# 2. Edit templates locally in ./templates
#    Use your editor, commit to git, review in PRs — whatever your flow is

# 3. Push your changes back
wayfront templates:push        # only pushes templates that changed

# 4. Commit your work
git add templates/
git commit -m "Update invoice template"
```

The `templates/` folder is yours to version control. Pull once, make changes over time, push when ready.

## Commands

```
wayfront                        Show connection status
wayfront init [workspace]       Connect a workspace
wayfront use <workspace>        Switch active workspace
wayfront templates:pull [name]  Pull templates (or one by name)
wayfront templates:push [name]  Push changed templates (or one by name)
wayfront templates:reset [name] Reset modified templates to default
```

## Template naming

Templates use dot-notation that maps to folders:

```
portal.invoices.show  →  templates/portal/invoices/show.twig
email.invoice_paid    →  templates/email/invoice_paid.twig
```

## Multiple workspaces

Each workspace is identified by its Wayfront username. You can connect more than one and switch between them:

```bash
wayfront init clientco    # connect a second workspace
wayfront use acme         # switch back
```

## Requirements

Node.js 18+
