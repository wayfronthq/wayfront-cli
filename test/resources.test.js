import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RESOURCE_COMMANDS, normalizeResourceActionArgs } from '../src/commands/resources.js';

describe('resource command definitions', () => {
  it('covers the selected API tags as first-class commands', () => {
    assert.equal(RESOURCE_COMMANDS.length, 16);
  });

  it('includes common business resources', () => {
    const names = RESOURCE_COMMANDS.map((resource) => resource.command);
    assert.ok(names.includes('orders'));
    assert.ok(names.includes('tickets'));
    assert.ok(names.includes('invoices'));
    assert.ok(names.includes('clients'));
  });

  it('includes special invoice and task actions', () => {
    const invoices = RESOURCE_COMMANDS.find((resource) => resource.command === 'invoices');
    const tasks = RESOURCE_COMMANDS.find((resource) => resource.command === 'tasks');

    assert.ok(invoices.operations.some((operation) => operation.action === 'charge'));
    assert.ok(invoices.operations.some((operation) => operation.action === 'mark-paid'));
    assert.ok(tasks.operations.some((operation) => operation.action === 'complete'));
    assert.ok(tasks.operations.some((operation) => operation.action === 'incomplete'));
  });

  it('normalizes Commander action arguments for variadic params', () => {
    const options = { json: undefined };
    const command = { args: ['limit=1'] };

    assert.deepEqual(normalizeResourceActionArgs([
      'ord_123',
      ['limit=1', 'expand[]=client'],
      options,
      command,
    ]), {
      positionalArgs: ['ord_123'],
      variadic: ['limit=1', 'expand[]=client'],
      options,
    });
  });
});
