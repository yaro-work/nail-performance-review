import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { realpath } from 'node:fs/promises';

export async function pullAndRefresh(packageRoot) {
  const repository = spawnSync('git', ['rev-parse', '--show-toplevel'], { cwd: packageRoot, encoding: 'utf8' });
  if (repository.error?.code === 'ENOENT') throw new Error('Install Git before using update --pull.');
  if (repository.status !== 0 || path.relative(await realpath(packageRoot), await realpath(repository.stdout.trim()))) {
    throw new Error('Use update --pull from a Git clone of nail-performance-review.');
  }
  const status = spawnSync('git', ['status', '--porcelain'], { cwd: packageRoot, encoding: 'utf8' });
  if (status.status !== 0 || status.stdout.trim()) throw new Error('Commit or move local changes before updating this clone.');
  const pull = spawnSync('git', ['pull', '--ff-only'], { cwd: packageRoot, stdio: ['inherit', 2, 2] });
  if (pull.status !== 0) throw new Error('Git could not fast-forward the clone. Review the Git output before retrying.');

  // Reload the updated CLI before rendering and installing its adapters.
  const refresh = spawnSync(process.execPath, [path.join(packageRoot, 'bin', 'nail.mjs'), 'update'], {
    cwd: packageRoot, stdio: 'inherit',
  });
  if (refresh.error) throw refresh.error;
  return refresh.status ?? 1;
}
