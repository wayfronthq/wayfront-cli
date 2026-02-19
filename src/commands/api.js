import { getWorkspaceConfig } from '../lib/config.js';
import { apiRequest } from '../lib/api.js';
import {
  fetchApiSpec,
  listOperations,
  getOperation,
  parseKeyValueArgs,
  buildOperationRequest,
} from '../lib/openapi.js';

function formatOperation(operation) {
  const summary = operation.summary ? ` - ${operation.summary}` : '';
  return `${operation.operationId}  ${operation.method} ${operation.path}${summary}`;
}

export function registerApi(program) {
  const api = program
    .command('api')
    .description('Use the raw API escape hatch');

  api
    .command('list [tag]')
    .description('List API operations from api.yaml')
    .action(async (tag) => {
      try {
        const workspace = getWorkspaceConfig();
        const spec = await fetchApiSpec(workspace.url);
        const operations = listOperations(spec)
          .filter((operation) => !tag || operation.tags.includes(tag));

        if (operations.length === 0) {
          const suffix = tag ? ` for tag "${tag}"` : '';
          console.error(`No API operations found${suffix}.`);
          process.exit(1);
        }

        for (const operation of operations) {
          console.log(formatOperation(operation));
        }
      } catch (error) {
        console.error(error.message);
        process.exit(1);
      }
    });

  api
    .command('call <operationId> [params...]')
    .description('Call any API operation by operationId')
    .option('--json <body>', 'JSON body to send for request payloads')
    .action(async (operationId, params, options) => {
      try {
        const workspace = getWorkspaceConfig();
        const spec = await fetchApiSpec(workspace.url);
        const operation = getOperation(spec, operationId);
        const args = parseKeyValueArgs(params || []);
        const request = buildOperationRequest(operation, args, options.json);
        const result = await apiRequest(request.method, request.path, request.body);

        if (result === null || result === undefined) {
          return;
        }

        if (typeof result === 'string') {
          console.log(result);
          return;
        }

        console.log(JSON.stringify(result, null, 2));
      } catch (error) {
        console.error(error.message);
        process.exit(1);
      }
    });
}
