// Answer pool, grouped by topic. Every word must be exactly 5 letters.
export const WORDS = {
  Security: ['PHISH','CYBER','TOKEN','CLOUD','PROXY','AUDIT','PATCH','SHELL','CRACK','VIRUS','SPOOF','LOGIN','ROUTE','HONEY','SCOPE','CRYPT','FUZZY','RISKS','ALERT','QUERY'],
  Music: ['CHORD','SCALE','TENOR','BLUES','SWING','TEMPO','NOTES','REEDS','BRASS','MAJOR','MINOR','FORTE','PITCH','JAZZY','BEBOP','ALTOS','SOLOS','TUNES','CLEFS','TRILL'],
  Linguistics: ['VOWEL','TONES','VERBS','NOUNS','SLANG','GLYPH','IDIOM','PROSE','SPEAK','WORDS','ROOTS','LEXIS']
};
export const POOL = Object.entries(WORDS).flatMap(([topic, list]) => list.map(word => ({ topic, word })));
