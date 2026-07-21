/**
 * Yayin oncesi surum etiketini (tag) olusturur ve GitHub'a gonderir.
 *
 * Neden gerekli: electron-builder yukleyecegi her dosya icin hedef release'i
 * ayri ayri arar. Tag yoksa ".exe", ".blockmap" ve "latest.yml" yuklemeleri
 * es zamanli calisip "release var mi?" sorusuna hepsi "yok" cevabini alir ve
 * her biri kendi taslagini acar - GitHub'da ayni surumden birden fazla taslak
 * olusur. Tag onceden mevcut oldugunda hepsi ayni release'i bulur.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const tag = `v${version}`;

// Calisma agaci temiz mi? Kirli bir agactan yayin, etiketin isaret ettigi
// koddan farkli bir ikili uretir.
const kirli = git("status", "--porcelain");
if (kirli) {
  console.error("Commit edilmemis degisiklikler var; yayin oncesi commit edin:\n" + kirli);
  process.exit(1);
}

const yerelVar = git("tag", "--list", tag) === tag;
if (yerelVar) {
  // Etiket baska bir commit'i gosteriyorsa sessizce devam etmek yaniltici olur.
  const etiketliCommit = git("rev-list", "-n", "1", tag);
  const suankiCommit = git("rev-parse", "HEAD");
  if (etiketliCommit !== suankiCommit) {
    console.error(
      `${tag} etiketi baska bir commit'i (${etiketliCommit.slice(0, 7)}) gosteriyor.\n` +
        `Surum numarasini yukseltin veya etiketi silin: git tag -d ${tag} && git push origin :${tag}`
    );
    process.exit(1);
  }
  console.log(`${tag} etiketi zaten mevcut.`);
} else {
  git("tag", "-a", tag, "-m", `Surum ${version}`);
  console.log(`${tag} etiketi olusturuldu.`);
}

// Uzakta yoksa gonder. Zaten varsa git "up to date" der, hata olmaz.
git("push", "origin", tag);
console.log(`${tag} GitHub'a gonderildi.`);
