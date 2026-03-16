import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const packageJsonPath = path.join(repoRoot, 'package.json');
const packageLockPath = path.join(repoRoot, 'package-lock.json');
const changelogPath = path.join(repoRoot, 'CHANGELOG.md');

function parseArgs(argv) {
  const args = {
    type: 'patch',
    messages: []
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === '--type') {
      args.type = argv[index + 1] || '';
      index += 1;
      continue;
    }

    if (value === '--message' || value === '--feature') {
      const message = argv[index + 1] || '';
      if (message.trim()) {
        args.messages.push(message.trim());
      }
      index += 1;
      continue;
    }
  }

  return args;
}

function bumpVersion(currentVersion, releaseType) {
  const match = String(currentVersion).trim().match(/^(\d+)\.(\d+)\.(\d+)$/);

  if (!match) {
    throw new Error(`Unsupported version format: ${currentVersion}`);
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);

  if (releaseType === 'major') {
    return `${major + 1}.0.0`;
  }

  if (releaseType === 'minor') {
    return `${major}.${minor + 1}.0`;
  }

  if (releaseType === 'patch') {
    return `${major}.${minor}.${patch + 1}`;
  }

  throw new Error(`Invalid release type: ${releaseType}`);
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function buildChangelogEntry(version, messages) {
  const releaseDate = new Date().toISOString().slice(0, 10);
  const lines = [`## [${version}] - ${releaseDate}`, '', '### Added'];

  for (const message of messages) {
    lines.push(`- ${message}`);
  }

  lines.push('');
  return lines.join('\n');
}

function updateChangelog(version, messages) {
  const header = [
    '# Changelog',
    '',
    'All notable changes to this project will be documented in this file.',
    '',
    'The release workflow uses semantic versioning. Each shipped feature should bump the version and add an entry here.',
    '',
    ''
  ].join('\n');

  let existingBody = '';

  if (fs.existsSync(changelogPath)) {
    const existing = fs.readFileSync(changelogPath, 'utf8');
    const firstReleaseIndex = existing.search(/^## \[/m);
    existingBody = firstReleaseIndex >= 0 ? existing.slice(firstReleaseIndex).trimStart() : '';
  }

  const nextEntry = buildChangelogEntry(version, messages);
  const body = existingBody ? `${nextEntry}\n${existingBody}\n` : `${nextEntry}\n`;

  fs.writeFileSync(changelogPath, `${header}${body}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.messages.length) {
    throw new Error('Provide at least one --message for the changelog entry.');
  }

  const packageJson = loadJson(packageJsonPath);
  const packageLock = loadJson(packageLockPath);
  const nextVersion = bumpVersion(packageJson.version, args.type);

  packageJson.version = nextVersion;
  packageLock.version = nextVersion;
  if (packageLock.packages?.['']) {
    packageLock.packages[''].version = nextVersion;
  }

  writeJson(packageJsonPath, packageJson);
  writeJson(packageLockPath, packageLock);
  updateChangelog(nextVersion, args.messages);

  console.log(`Released ${nextVersion}`);
  for (const message of args.messages) {
    console.log(`- ${message}`);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
