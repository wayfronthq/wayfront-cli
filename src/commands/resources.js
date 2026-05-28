import { getWorkspaceConfig } from '../lib/config.js';
import { apiRequest } from '../lib/api.js';
import {
  fetchApiSpec,
  getOperation,
  parseKeyValueArgs,
  buildOperationRequest,
} from '../lib/openapi.js';

export const RESOURCE_COMMANDS = [
  {
    command: 'client-activities',
    description: 'Work with client activities',
    operations: [
      { action: 'list', operationId: 'clientActivitiesIndex', summary: 'List all activities for a client', pathParams: ['user'] },
      { action: 'create', operationId: 'clientActivitiesStore', summary: 'Create an activity', pathParams: ['user'] },
      { action: 'get', operationId: 'clientActivitiesShow', summary: 'Get an activity', pathParams: ['user', 'activity'] },
      { action: 'update', operationId: 'clientActivitiesUpdate', summary: 'Update an activity', pathParams: ['user', 'activity'] },
      { action: 'delete', operationId: 'clientActivitiesDestroy', summary: 'Delete an activity', pathParams: ['user', 'activity'] },
    ],
  },
  {
    command: 'clients',
    description: 'Work with clients',
    operations: [
      { action: 'list', operationId: 'clientsIndex', summary: 'List all clients', pathParams: [] },
      { action: 'create', operationId: 'clientsStore', summary: 'Create a client', pathParams: [] },
      { action: 'get', operationId: 'clientsShow', summary: 'Retrieve a client', pathParams: ['user'] },
      { action: 'update', operationId: 'clientsUpdate', summary: 'Update a client', pathParams: ['user'] },
      { action: 'delete', operationId: 'clientsDestroy', summary: 'Delete a client', pathParams: ['user'] },
    ],
  },
  {
    command: 'coupons',
    description: 'Work with coupons',
    operations: [
      { action: 'list', operationId: 'couponsIndex', summary: 'List all coupons', pathParams: [] },
      { action: 'create', operationId: 'couponsStore', summary: 'Create a coupon', pathParams: [] },
      { action: 'get', operationId: 'couponsShow', summary: 'Retrieve a coupon', pathParams: ['coupon'] },
      { action: 'update', operationId: 'couponsUpdate', summary: 'Update a coupon', pathParams: ['coupon'] },
      { action: 'delete', operationId: 'couponsDestroy', summary: 'Delete a coupon', pathParams: ['coupon'] },
    ],
  },
  {
    command: 'filled-form-fields',
    description: 'Work with filled form fields',
    operations: [
      { action: 'list', operationId: 'indexFilledFormFields', summary: 'List all filled form fields', pathParams: [] },
      { action: 'create', operationId: 'storeFilledFormField', summary: 'Create a filled form field', pathParams: [] },
      { action: 'get', operationId: 'showFilledFormField', summary: 'Retrieve a filled form field', pathParams: ['field'] },
      { action: 'update', operationId: 'updateFilledFormField', summary: 'Update a filled form field', pathParams: ['field'] },
      { action: 'delete', operationId: 'destroyFilledFormField', summary: 'Delete a filled form field', pathParams: ['field'] },
    ],
  },
  {
    command: 'invoices',
    description: 'Work with invoices',
    operations: [
      { action: 'list', operationId: 'getInvoices', summary: 'List all invoices', pathParams: [] },
      { action: 'create', operationId: 'createInvoice', summary: 'Create an invoice', pathParams: [] },
      { action: 'get', operationId: 'getInvoiceById', summary: 'Retrieve an invoice', pathParams: ['invoice'] },
      { action: 'update', operationId: 'updateInvoice', summary: 'Update an invoice', pathParams: ['invoice'] },
      { action: 'delete', operationId: 'deleteInvoice', summary: 'Delete an invoice', pathParams: ['invoice'] },
      { action: 'charge', operationId: 'chargeInvoice', summary: 'Charge an invoice', pathParams: ['invoice'] },
      { action: 'mark-paid', operationId: 'markInvoicePaid', summary: 'Mark invoice as paid', pathParams: ['invoice'] },
    ],
  },
  {
    command: 'logs',
    description: 'Work with logs',
    operations: [
      { action: 'list', operationId: 'logsIndex', summary: 'List all logs', pathParams: [] },
    ],
  },
  {
    command: 'order-messages',
    description: 'Work with order messages',
    operations: [
      { action: 'list', operationId: 'orderMessagesIndex', summary: 'List all messages for an order', pathParams: ['order'] },
      { action: 'create', operationId: 'orderMessagesStore', summary: 'Create a message for an order', pathParams: ['order'] },
      { action: 'delete', operationId: 'orderMessagesDestroy', summary: 'Delete a message', pathParams: ['message'] },
    ],
  },
  {
    command: 'order-tasks',
    description: 'Work with order tasks',
    operations: [
      { action: 'list', operationId: 'orderTasksIndex', summary: 'List all tasks for an order', pathParams: ['order'] },
      { action: 'create', operationId: 'orderTasksStore', summary: 'Create a task for an order', pathParams: ['order'] },
      { action: 'update', operationId: 'orderTasksUpdate', summary: 'Update a task', pathParams: ['task'] },
      { action: 'delete', operationId: 'orderTasksDestroy', summary: 'Delete a task', pathParams: ['task'] },
    ],
  },
  {
    command: 'orders',
    description: 'Work with orders',
    operations: [
      { action: 'list', operationId: 'ordersIndex', summary: 'List all orders', pathParams: [] },
      { action: 'create', operationId: 'ordersStore', summary: 'Create an order', pathParams: [] },
      { action: 'get', operationId: 'ordersShow', summary: 'Retrieve an order', pathParams: ['order'] },
      { action: 'update', operationId: 'ordersUpdate', summary: 'Update an order', pathParams: ['order'] },
      { action: 'delete', operationId: 'ordersDestroy', summary: 'Delete an order', pathParams: ['order'] },
    ],
  },
  {
    command: 'services',
    description: 'Work with services',
    operations: [
      { action: 'list', operationId: 'servicesIndex', summary: 'List all services', pathParams: [] },
      { action: 'create', operationId: 'servicesStore', summary: 'Create a service', pathParams: [] },
      { action: 'get', operationId: 'servicesShow', summary: 'Retrieve a service', pathParams: ['service'] },
      { action: 'update', operationId: 'servicesUpdate', summary: 'Update a service', pathParams: ['service'] },
      { action: 'delete', operationId: 'servicesDestroy', summary: 'Delete a service', pathParams: ['service'] },
    ],
  },
  {
    command: 'subscriptions',
    description: 'Work with subscriptions',
    operations: [
      { action: 'list', operationId: 'subscriptionsIndex', summary: 'List all subscriptions', pathParams: [] },
      { action: 'get', operationId: 'subscriptionsShow', summary: 'Retrieve a subscription', pathParams: ['subscription'] },
      { action: 'update', operationId: 'subscriptionUpdate', summary: 'Update a subscription', pathParams: ['subscription'] },
    ],
  },
  {
    command: 'tags',
    description: 'Work with tags',
    operations: [
      { action: 'list', operationId: 'tagsIndex', summary: 'List all tags', pathParams: [] },
    ],
  },
  {
    command: 'tasks',
    description: 'Work with task completion state',
    operations: [
      { action: 'complete', operationId: 'markTaskComplete', summary: 'Mark task as complete', pathParams: ['task'] },
      { action: 'incomplete', operationId: 'markTaskIncomplete', summary: 'Mark task as incomplete', pathParams: ['task'] },
    ],
  },
  {
    command: 'team',
    description: 'Work with team members',
    operations: [
      { action: 'list', operationId: 'teamIndex', summary: 'List all team members', pathParams: [] },
      { action: 'get', operationId: 'teamShow', summary: 'Get team member', pathParams: ['user'] },
    ],
  },
  {
    command: 'ticket-messages',
    description: 'Work with ticket messages',
    operations: [
      { action: 'list', operationId: 'ticketMessagesIndex', summary: 'List all messages for the ticket', pathParams: ['ticket'] },
      { action: 'create', operationId: 'ticketMessagesStore', summary: 'Create a message for the ticket', pathParams: ['ticket'] },
      { action: 'delete', operationId: 'ticketMessagesDestroy', summary: 'Delete a message', pathParams: ['message'] },
    ],
  },
  {
    command: 'tickets',
    description: 'Work with tickets',
    operations: [
      { action: 'list', operationId: 'ticketsIndex', summary: 'List all tickets', pathParams: [] },
      { action: 'create', operationId: 'ticketsStore', summary: 'Create a ticket', pathParams: [] },
      { action: 'get', operationId: 'ticketsShow', summary: 'Retrieve a ticket', pathParams: ['ticket'] },
      { action: 'update', operationId: 'ticketsUpdate', summary: 'Update a ticket', pathParams: ['ticket'] },
      { action: 'delete', operationId: 'ticketsDestroy', summary: 'Delete a ticket', pathParams: ['ticket'] },
    ],
  },
];

const specCache = new Map();

async function getCachedSpec() {
  const workspace = getWorkspaceConfig();
  if (!specCache.has(workspace.url)) {
    specCache.set(workspace.url, await fetchApiSpec(workspace.url));
  }
  return specCache.get(workspace.url);
}

function commandSignature(operation) {
  const positional = operation.pathParams.map((name) => `<${name}>`).join(' ');
  return `${operation.action}${positional ? ` ${positional}` : ''} [params...]`;
}

export function normalizeResourceActionArgs(rawArgs) {
  const args = [...rawArgs];
  args.pop(); // Commander passes the command instance as the final action argument.
  const options = args.pop() || {};
  const variadic = Array.isArray(args.at(-1)) ? args.pop() : [];

  return {
    positionalArgs: args,
    variadic,
    options,
  };
}

async function runResourceOperation(definition, rawArgs) {
  const { positionalArgs, variadic, options } = normalizeResourceActionArgs(rawArgs);
  const positional = {};

  definition.pathParams.forEach((name, index) => {
    positional[name] = positionalArgs[index];
  });

  const spec = await getCachedSpec();
  const operation = getOperation(spec, definition.operationId);
  const extra = parseKeyValueArgs(variadic || []);
  const request = buildOperationRequest(operation, { ...positional, ...extra }, options.json);
  const result = await apiRequest(request.method, request.path, request.body);

  if (result === null || result === undefined) return;
  if (typeof result === 'string') {
    console.log(result);
    return;
  }

  console.log(JSON.stringify(result, null, 2));
}

export function registerResources(program) {
  for (const resource of RESOURCE_COMMANDS) {
    const group = program
      .command(resource.command)
      .description(resource.description);

    for (const operation of resource.operations) {
      group
        .command(commandSignature(operation))
        .description(operation.summary)
        .option('--json <body>', 'JSON body to send for request payloads')
        .action(async (...args) => {
          try {
            await runResourceOperation(operation, args);
          } catch (error) {
            console.error(error.message);
            process.exit(1);
          }
        });
    }
  }
}
