// "All skills open" test switch (Skill Book): every job's skills and passives usable at any level. Kept per browser.
const KEY = 'godoflegacy.allSkills';
export function allSkillsOpen(): boolean { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } }
export function setAllSkillsOpen(on: boolean): void { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* storage unavailable */ } }
