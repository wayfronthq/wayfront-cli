import { runTemplatesPull } from './templates-pull.js';
import { runTemplatesPush } from './templates-push.js';
import { runTemplatesReset } from './templates-reset.js';

export function registerTemplates(program) {
  const templates = program
    .command('templates')
    .description('Work with template files in your workspace');

  templates
    .command('pull [name]')
    .description('Pull templates from the API, or one by name')
    .action(async (name) => {
      await runTemplatesPull(name);
    });

  templates
    .command('push [name]')
    .description('Push changed templates to the API, or one by name')
    .action(async (name) => {
      await runTemplatesPush(name);
    });

  templates
    .command('reset [name]')
    .description('Reset modified templates to default, or one by name')
    .action(async (name) => {
      await runTemplatesReset(name);
    });
}
