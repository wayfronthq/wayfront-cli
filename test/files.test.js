import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { nameToPath, pathToName } from '../src/lib/files.js';

describe('nameToPath', () => {
  it('converts dot-notation to nested path', () => {
    assert.equal(nameToPath('portal.invoices.show'), 'templates/portal/invoices/show.twig');
  });

  it('single segment', () => {
    assert.equal(nameToPath('layout'), 'templates/layout.twig');
  });

  it('respects custom dir', () => {
    assert.equal(nameToPath('portal.index', './custom'), 'custom/portal/index.twig');
  });
});

describe('pathToName', () => {
  it('converts nested path to dot-notation', () => {
    assert.equal(pathToName('templates/portal/invoices/show.twig'), 'portal.invoices.show');
  });

  it('single file', () => {
    assert.equal(pathToName('templates/layout.twig'), 'layout');
  });

  it('respects custom dir', () => {
    assert.equal(pathToName('custom/portal/index.twig', './custom'), 'portal.index');
  });
});

describe('nameToPath — names with hyphens', () => {
  it('hyphenated segments', () => {
    assert.equal(nameToPath('contact-forms.show'), 'templates/contact-forms/show.twig');
  });

  it('underscore prefix', () => {
    assert.equal(nameToPath('invoices._invoice'), 'templates/invoices/_invoice.twig');
  });
});

describe('roundtrip', () => {
  const names = ['portal.invoices.show', 'layout', 'custom.email.header', 'portal.index', 'contact-forms.show', 'invoices._invoice'];

  for (const name of names) {
    it(`${name} survives roundtrip`, () => {
      assert.equal(pathToName(nameToPath(name)), name);
    });
  }
});
