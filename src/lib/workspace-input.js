import { prompt } from './prompt.js';

export function parseWorkspaceInput(input) {
  if (/^https?:\/\//.test(input)) {
    const parsed = new URL(input);
    const wayfrontMatch = parsed.hostname.match(/^([^.]+)\.wayfront\.com$/);
    if (wayfrontMatch) {
      return { workspace: wayfrontMatch[1], url: null };
    }
    return { workspace: parsed.hostname.split('.')[0], url: `${parsed.protocol}//${parsed.host}` };
  }

  const wayfrontMatch = input.match(/^([^.]+)\.wayfront\.com$/);
  if (wayfrontMatch) {
    return { workspace: wayfrontMatch[1], url: null };
  }

  if (input.includes('.')) {
    return { workspace: input.split('.')[0], url: `https://${input}` };
  }

  return { workspace: input, url: null };
}

export async function promptForWorkspaceInput() {
  const answer = await prompt('Workspace: ');
  if (!answer) {
    throw new Error('No workspace provided.');
  }

  return parseWorkspaceInput(answer);
}
