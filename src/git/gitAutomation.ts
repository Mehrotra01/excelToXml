import simpleGit from 'simple-git';
import path from 'path';

const repoPath = path.join(__dirname, '../../output');

export async function commitAndPushChanges(commitMessage: string) {
  const git = simpleGit(repoPath);

  const isRepo = await git.checkIsRepo();

  if (!isRepo) {
    await git.init();
    await git.add('.');
    await git.commit('Initial commit');
    return;
  }

  await git.add('.');
  await git.commit(commitMessage || 'Update XML files');
}
