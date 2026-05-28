import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseApiSpec,
  listOperations,
  getOperation,
  parseKeyValueArgs,
  buildOperationRequest,
} from '../src/lib/openapi.js';

const specText = `openapi: 3.0.0
paths:
  /orders:
    get:
      operationId: ordersIndex
      summary: List orders
      tags: [Orders]
      parameters:
        - name: page
          in: query
          schema:
            type: integer
  /orders/{order}:
    patch:
      operationId: ordersUpdate
      summary: Update order
      tags: [Orders]
      parameters:
        - name: order
          in: path
          required: true
          schema:
            type: string
        - name: include
          in: query
          schema:
            type: string
      requestBody:
        required: true
  /templates/{template}:
    put:
      operationId: templatesUpdate
      summary: Update template
      tags: [Templates]
      parameters:
        - name: template
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
`

describe('openapi helpers', () => {
  it('parses api spec and lists operations', () => {
    const spec = parseApiSpec(specText);
    const operations = listOperations(spec);

    assert.equal(operations.length, 3);
    assert.equal(operations[0].operationId, 'ordersIndex');
    assert.equal(operations[1].operationId, 'ordersUpdate');
    assert.equal(operations[2].operationId, 'templatesUpdate');
  });

  it('gets operation by id', () => {
    const spec = parseApiSpec(specText);
    const operation = getOperation(spec, 'templatesUpdate');

    assert.equal(operation.method, 'PUT');
    assert.equal(operation.path, '/templates/{template}');
  });

  it('parses repeated key value args', () => {
    assert.deepEqual(parseKeyValueArgs(['template=portal.home', 'page=2']), {
      template: 'portal.home',
      page: '2',
    });
  });

  it('builds request with path, query, and body fields', () => {
    const spec = parseApiSpec(specText);
    const operation = getOperation(spec, 'ordersUpdate');

    assert.deepEqual(buildOperationRequest(operation, {
      order: 'ord_123',
      include: 'invoice',
      status: 'paid',
    }), {
      method: 'PATCH',
      path: '/orders/ord_123?include=invoice',
      body: {
        status: 'paid',
      },
    });
  });

  it('throws when required path params are missing', () => {
    const spec = parseApiSpec(specText);
    const operation = getOperation(spec, 'templatesUpdate');

    assert.throws(() => buildOperationRequest(operation, {
      data: '<h1>Hello</h1>',
    }), /Missing required path parameter: template/);
  });
});
