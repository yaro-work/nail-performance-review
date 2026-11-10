import { trackingStatus } from './config.mjs';
import { inspectInstallations } from './install.mjs';
import { listEvidence, validSessionId } from './records.mjs';

export async function trackingHealth(root, options = {}) {
  if (options.session !== undefined && !validSessionId(options.session)) throw new Error('Invalid session ID.');
  const [tracking, installations, history] = await Promise.all([
    trackingStatus(options), inspectInstallations(options), listEvidence(root, { includeSuperseded: true }),
  ]);
  const enabled = tracking.root === root;
  const candidates = history.filter(record => record.reviewStatus === 'candidate');
  const hosts = installations.filter(({ target }) => target !== 'generic').map(installation => {
    const { target, installed, missing, issues } = installation;
    const matching = candidates.filter(record => record.source === target);
    const lastCandidateAt = matching.reduce((latest, record) => !latest || record.recordedAt > latest ? record.recordedAt : latest, null);
    const candidateInSession = Boolean(options.session && matching.some(record => record.sessionId === options.session));
    return { target, installedByCli: installed, missing, issues, lastCandidateAt, candidateInSession };
  });
  return { workspace: tracking.workspace, enabled, scope: enabled ? tracking.scope ?? 'folder' : null, hosts };
}
