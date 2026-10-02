// Answer pool, grouped by topic. Every word must be exactly 5 letters.
export const WORDS = {
  Security: ['PHISH','CYBER','TOKEN','PATCH','SHELL','CRACK','VIRUS','SPOOF','LOGIN','HONEY','CRYPT','FUZZY','RISKS','ALERT','AUDIT','SALTS'],
  Network: ['PROXY','ROUTE','PORTS','HOSTS','TRACE','SCANS','FLOWS','BYTES','LOGON','CERTS','PINGS'],
  Cloud: ['CLOUD','AZURE','STACK','NODES','QUERY','SCOPE','ROLES','QUOTA','ADMIN','BLOBS','CACHE','SCALE','AGENT']
};
export const POOL = Object.entries(WORDS).flatMap(([topic, list]) => list.map(word => ({ topic, word })));
