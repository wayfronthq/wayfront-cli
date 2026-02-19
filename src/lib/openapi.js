import YAML from 'yaml';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

export function parseApiSpec(text) {
  return YAML.parse(text);
}

export function listOperations(spec) {
  const operations = [];

  for (const [path, pathItem] of Object.entries(spec?.paths || {})) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem?.[method];
      if (!operation?.operationId) continue;

      operations.push({
        operationId: operation.operationId,
        method: method.toUpperCase(),
        path,
        summary: operation.summary || '',
        tags: operation.tags || [],
        parameters: operation.parameters || [],
        requestBody: operation.requestBody || null,
      });
    }
  }

  return operations.sort((a, b) => a.operationId.localeCompare(b.operationId));
}

export function getOperation(spec, operationId) {
  const operation = listOperations(spec).find((item) => item.operationId === operationId);
  if (!operation) {
    throw new Error(`Unknown operation: ${operationId}`);
  }
  return operation;
}

export function parseKeyValueArgs(values = []) {
  const args = {};

  for (const value of values) {
    const separatorIndex = value.indexOf('=');
    if (separatorIndex === -1) {
      throw new Error(`Arguments must be in key=value format. Received: ${value}`);
    }

    const key = value.slice(0, separatorIndex);
    const rawValue = value.slice(separatorIndex + 1);
    args[key] = rawValue;
  }

  return args;
}

export function buildOperationRequest(operation, args, jsonBody = null) {
  const pathParameters = operation.parameters.filter((parameter) => parameter.in === 'path');
  const queryParameters = operation.parameters.filter((parameter) => parameter.in === 'query');
  const queryParameterNames = new Set(queryParameters.map((parameter) => parameter.name));

  let path = operation.path;
  for (const parameter of pathParameters) {
    const value = args[parameter.name];
    if (value === undefined || value === null || value === '') {
      throw new Error(`Missing required path parameter: ${parameter.name}`);
    }
    path = path.replace(`{${parameter.name}}`, encodeURIComponent(value));
  }

  const query = new URLSearchParams();
  const remaining = {};

  for (const [key, value] of Object.entries(args)) {
    if (queryParameterNames.has(key)) {
      query.append(key, value);
      continue;
    }

    if (!pathParameters.some((parameter) => parameter.name === key)) {
      remaining[key] = value;
    }
  }

  const body = jsonBody
    ? JSON.parse(jsonBody)
    : operation.requestBody
      ? remaining
      : undefined;

  const queryString = query.toString();

  return {
    method: operation.method,
    path: queryString ? `${path}?${queryString}` : path,
    body,
  };
}

export async function fetchApiSpec(baseUrl) {
  const response = await fetch(`${baseUrl}/api.yaml`, {
    headers: { Accept: 'text/yaml, text/plain, application/yaml, application/x-yaml' },
  });

  if (!response.ok) {
    throw new Error(`Could not fetch API spec from ${baseUrl}/api.yaml`);
  }

  return parseApiSpec(await response.text());
}
