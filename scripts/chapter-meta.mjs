// Canonical chapter metadata not contained in the KFGQPC data files.
// - slugs follow quran.com URL slugs so links like /al-baqarah?startingVerse=14 work.
// - revelation place follows the Madinah Mushaf header for each surah (مكية / مدنية).
// - English meanings are the conventional names used by quran.com.
export const SLUGS = [
  'al-fatihah','al-baqarah','ali-imran','an-nisa','al-maidah','al-anam','al-araf','al-anfal','at-tawbah','yunus',
  'hud','yusuf','ar-rad','ibrahim','al-hijr','an-nahl','al-isra','al-kahf','maryam','taha',
  'al-anbya','al-hajj','al-muminun','an-nur','al-furqan','ash-shuara','an-naml','al-qasas','al-ankabut','ar-rum',
  'luqman','as-sajdah','al-ahzab','saba','fatir','ya-sin','as-saffat','sad','az-zumar','ghafir',
  'fussilat','ash-shuraa','az-zukhruf','ad-dukhan','al-jathiyah','al-ahqaf','muhammad','al-fath','al-hujurat','qaf',
  'adh-dhariyat','at-tur','an-najm','al-qamar','ar-rahman','al-waqiah','al-hadid','al-mujadila','al-hashr','al-mumtahanah',
  'as-saf','al-jumuah','al-munafiqun','at-taghabun','at-talaq','at-tahrim','al-mulk','al-qalam','al-haqqah','al-maarij',
  'nuh','al-jinn','al-muzzammil','al-muddaththir','al-qiyamah','al-insan','al-mursalat','an-naba','an-naziat','abasa',
  'at-takwir','al-infitar','al-mutaffifin','al-inshiqaq','al-buruj','at-tariq','al-ala','al-ghashiyah','al-fajr','al-balad',
  'ash-shams','al-layl','ad-duhaa','ash-sharh','at-tin','al-alaq','al-qadr','al-bayyinah','az-zalzalah','al-adiyat',
  'al-qariah','at-takathur','al-asr','al-humazah','al-fil','quraysh','al-maun','al-kawthar','al-kafirun','an-nasr',
  'al-masad','al-ikhlas','al-falaq','an-nas',
];

export const MEANINGS = [
  'The Opener','The Cow','Family of Imran','The Women','The Table Spread','The Cattle','The Heights','The Spoils of War','The Repentance','Jonah',
  'Hud','Joseph','The Thunder','Abraham','The Rocky Tract','The Bee','The Night Journey','The Cave','Mary','Ta-Ha',
  'The Prophets','The Pilgrimage','The Believers','The Light','The Criterion','The Poets','The Ant','The Stories','The Spider','The Romans',
  'Luqman','The Prostration','The Combined Forces','Sheba','Originator','Ya Sin','Those who set the Ranks','The Letter "Saad"','The Troops','The Forgiver',
  'Explained in Detail','The Consultation','The Ornaments of Gold','The Smoke','The Crouching','The Wind-Curved Sandhills','Muhammad','The Victory','The Rooms','The Letter "Qaf"',
  'The Winnowing Winds','The Mount','The Star','The Moon','The Beneficent','The Inevitable','The Iron','The Pleading Woman','The Exile','She that is to be examined',
  'The Ranks','The Congregation, Friday','The Hypocrites','The Mutual Disillusion','The Divorce','The Prohibition','The Sovereignty','The Pen','The Reality','The Ascending Stairways',
  'Noah','The Jinn','The Enshrouded One','The Cloaked One','The Resurrection','The Man','The Emissaries','The Tidings','Those who drag forth','He Frowned',
  'The Overthrowing','The Cleaving','The Defrauding','The Sundering','The Mansions of the Stars','The Nightcomer','The Most High','The Overwhelming','The Dawn','The City',
  'The Sun','The Night','The Morning Hours','The Relief','The Fig','The Clot','The Power','The Clear Proof','The Earthquake','The Courser',
  'The Calamity','The Rivalry in world increase','The Declining Day','The Traducer','The Elephant','Quraysh','The Small Kindnesses','The Abundance','The Disbelievers','The Divine Support',
  'The Palm Fiber','The Sincerity','The Daybreak','Mankind',
];

// Madani surahs per the Madinah Mushaf headers; everything else is Makki.
export const MADANI = new Set([2,3,4,5,8,9,13,22,24,33,47,48,49,55,57,58,59,60,61,62,63,64,65,66,76,98,99,110]);

// Canonical Hafs verse counts (total 6236) used only to VERIFY the KFGQPC data at build time.
export const VERSE_COUNTS = [
  7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,
  34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,
  14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,
  15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6,
];
