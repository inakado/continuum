const transliteration: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', і: 'i', ї: 'yi', є: 'ye', ґ: 'g',
};

export function studentLoginBase(lastName: string): string {
  const stem = [...lastName.trim().toLowerCase().normalize('NFC')]
    .map((letter) => transliteration[letter] ?? letter).join('')
    .normalize('NFKD').replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 48);
  if (!stem) return 'student';
  return stem.length < 3 ? `s-${stem}` : stem;
}

export function reserveStudentLogin(lastName: string, used: Set<string>): string {
  const base = studentLoginBase(lastName);
  let login = base;
  for (let suffix = 2; used.has(login); suffix++) login = `${base}${suffix}`;
  used.add(login);
  return login;
}
