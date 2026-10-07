import type { Era, Source } from '../../../schema/release.ts';

/** RBI Handbook Table 44: until 28 Oct 2004 "repo" meant absorbing liquidity; the names were interchanged from 29 Oct 2004. */
export const IN_LAF_2004: Source = {
  id: 'in-laf-2004', type: 'reference', official: true, publishedAt: null, retrievedAt: null, sha256: null,
  title: 'RBI Handbook of Statistics, Table 44: Major monetary policy rates (repo and reverse repo nomenclature interchanged from 29 Oct 2004)',
  url: 'https://rbidocs.rbi.org.in/rdocs/Publications/PDFs/TABLE4481AA634C0907458C91DC0497720652F4.PDF',
};

export const IN_ERAS: Era[] = [
  {
    id: 'in-auction', from: '2000-06-05', to: '2004-10-28', instrument: 'Repo rate (pre-2004 usage: absorption)', kind: 'point', basis: 'observation', sourceId: IN_LAF_2004.id,
    note: 'Before 29 Oct 2004, RBI used "repo" for operations that absorbed liquidity. These values are kept as observations and left out of findings.',
  },
  {
    id: 'in-repo', from: '2004-10-29', to: null, instrument: 'Policy repo rate', kind: 'point', basis: 'policy', sourceId: IN_LAF_2004.id,
    note: 'The repo rate in its international sense: the rate at which RBI lends to banks. Set by the Monetary Policy Committee since 4 Oct 2016.',
  },
];
