export interface ChangelogRelease {
  commit: string
  date: string
  latest?: boolean
  version: string
}

export const changelogReleases = {
  '2.3.1': {
    commit: '25cd25b',
    date: '2026-08-08',
    latest: true,
    version: '2.3.1',
  },
  '2.3.0': {
    commit: '2a3209d',
    date: '2026-08-07',
    version: '2.3.0',
  },
  '2.2.2': {
    commit: '2a3209d',
    date: '2026-08-07',
    version: '2.2.2',
  },
  '2.2.1': {
    commit: '74c94b7',
    date: '2026-08-07',
    version: '2.2.1',
  },
  '2.2.0': {
    commit: '610290b',
    date: '2026-06-06',
    version: '2.2.0',
  },
  '2.1.1': {
    commit: '75dbb94',
    date: '2026-06-05',
    version: '2.1.1',
  },
  '2.1.0': {
    commit: '7572440',
    date: '2026-06-03',
    version: '2.1.0',
  },
  '2.0.1': {
    commit: 'fed3030',
    date: '2026-06-01',
    version: '2.0.1',
  },
  '2.0.0': {
    commit: 'ddf7f2f',
    date: '2026-06-01',
    version: '2.0.0',
  },
} satisfies Record<string, ChangelogRelease>
