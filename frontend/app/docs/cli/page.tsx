import { CodeBlock, Note, Heading } from '../components';

export const metadata = { title: 'CLI — ZendBX Docs' };

const install = `pip install zendbx-cli
# or
pip install -e "git+https://github.com/zengomadrid-ui/zendbx-.git#egg=zendbx-cli&subdirectory=zendbx-cli"`;

const connect = `zendbx connect --url https://api.zendbx.in --key YOUR_API_KEY`;

const commands = `# Project management
zendbx status                          # Show current connection and project
zendbx init                            # Initialize a new project

# Database
zendbx db dump --output backup.sql     # Dump database to SQL file
zendbx db restore --input backup.sql   # Restore from SQL file
zendbx db analyze                      # Analyze table statistics
zendbx db fix                          # Auto-fix common SQL issues`;

export default function CLIPage() {
  return (
    <article>
      <Heading level={1}>CLI</Heading>
      <p className="text-sm text-gray-400 mb-8">
        The ZendBX CLI lets you manage projects, run backups, and analyze your database from the terminal.
      </p>

      <Heading level={2} id="install">Installation</Heading>
      <CodeBlock code={install} lang="bash" />

      <Heading level={2} id="connect">Connect to a Project</Heading>
      <CodeBlock code={connect} lang="bash" />

      <Heading level={2} id="commands">Commands</Heading>
      <CodeBlock code={commands} lang="bash" />

      <Note>
        Run <code className="text-orange-400">zendbx --help</code> or <code className="text-orange-400">zendbx {'<command>'} --help</code> for full usage information.
      </Note>
    </article>
  );
}
