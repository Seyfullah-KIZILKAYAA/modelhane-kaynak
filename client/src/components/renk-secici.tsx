import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { RENKLER, DIGER_RENK } from "@shared/renkler";

/**
 * Aranabilir renk seçici.
 *
 * Nebim renk kataloğundaki ~335 rengi bir açılır kutuda gösterir; yazarak
 * renk adına veya koduna göre filtrelenir. En üstte "Diğer" seçeneği vardır:
 * seçilince kullanıcı listede olmayan bir rengi elle yazabilir.
 *
 * Saklanan değer renk **adıdır** (ör. "Lacivert"); "Diğer" ile elle yazılan
 * metin de doğrudan saklanır. Boş bırakılabilir (renk opsiyonel).
 *
 * Not: Katalog büyük olduğu için cmdk'nın dahili filtresi kapatılıp arama
 * elle yapılır ve sonuç sayısı sınırlanır — böylece her tuş vuruşunda 335
 * satır render edilmez.
 */

/** Türkçe karakterleri sadeleştirip küçük harfe çevirir (arama için). */
function normalize(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

const MAX_SONUC = 80;

export function RenkSecici({
  value,
  onChange,
  testId,
}: {
  value: string;
  onChange: (renk: string) => void;
  testId?: string;
}) {
  const [acik, setAcik] = useState(false);
  const [arama, setArama] = useState("");

  // Değer katalogda var mı? Yoksa ve boş değilse kullanıcı "Diğer" ile yazmış.
  const katalogdaVar = useMemo(() => RENKLER.some((r) => r.ad === value), [value]);

  // "Diğer" (elle giriş) modu. Kullanıcı listeden "Diğer"e basınca açılır;
  // ayrıca dışarıdan gelen değer (düzenleme) katalogda yoksa da açık kabul edilir.
  const [digerModu, setDigerModu] = useState(false);
  useEffect(() => {
    // Düzenleme: mevcut renk katalogda olmayan bir metinse elle giriş göster.
    if (value && !katalogdaVar) setDigerModu(true);
  }, [value, katalogdaVar]);

  const sonuclar = useMemo(() => {
    const q = normalize(arama.trim());
    if (!q) return RENKLER.slice(0, MAX_SONUC);
    return RENKLER.filter(
      (r) => normalize(r.ad).includes(q) || normalize(r.kod).includes(q),
    ).slice(0, MAX_SONUC);
  }, [arama]);

  const digerAktif = digerModu || (!!value && !katalogdaVar);

  let etiket = "Renk seçin (opsiyonel)";
  if (digerAktif) etiket = value ? value : `${DIGER_RENK} (elle giriş)`;
  else if (value) etiket = value;

  return (
    <div className="space-y-1.5">
      <Popover open={acik} onOpenChange={setAcik}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={acik}
            data-testid={testId}
            className={cn(
              "w-full justify-between font-normal",
              !value && !digerAktif && "text-muted-foreground",
            )}
          >
            <span className="flex items-center gap-2 truncate">
              <Palette className="w-4 h-4 shrink-0 text-primary/70" />
              <span className="truncate">{etiket}</span>
            </span>
            <ChevronsUpDown className="w-4 h-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Renk ara..." value={arama} onValueChange={setArama} />
            <CommandList>
              <CommandEmpty>Renk bulunamadı.</CommandEmpty>
              <CommandGroup>
                {/* En başta: Diğer (elle giriş) */}
                <CommandItem
                  value="__diger__"
                  onSelect={() => {
                    setDigerModu(true);
                    onChange("");
                    setAcik(false);
                    setArama("");
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", digerAktif ? "opacity-100" : "opacity-0")} />
                  {DIGER_RENK} (listede yoksa elle yaz)
                </CommandItem>

                {/* Renk yok (temizle) */}
                <CommandItem
                  value="__temizle__"
                  onSelect={() => {
                    setDigerModu(false);
                    onChange("");
                    setAcik(false);
                    setArama("");
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", !value && !digerAktif ? "opacity-100" : "opacity-0")} />
                  — Renk yok
                </CommandItem>

                {sonuclar.map((r) => (
                  <CommandItem
                    key={r.kod + r.ad}
                    value={r.kod + " " + r.ad}
                    onSelect={() => {
                      setDigerModu(false);
                      onChange(r.ad);
                      setAcik(false);
                      setArama("");
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === r.ad ? "opacity-100" : "opacity-0")} />
                    {r.hex ? (
                      <span
                        className="mr-2 h-3.5 w-3.5 rounded-full border shrink-0"
                        style={{ backgroundColor: r.hex }}
                      />
                    ) : (
                      <span className="mr-2 h-3.5 w-3.5 rounded-full border border-dashed shrink-0" />
                    )}
                    <span className="truncate">{r.ad}</span>
                    <span className="ml-auto pl-2 text-xs text-muted-foreground shrink-0">{r.kod}</span>
                  </CommandItem>
                ))}
                {sonuclar.length >= MAX_SONUC && (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">
                    Çok fazla sonuç — aramayı daraltın.
                  </p>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* "Diğer" seçildiyse elle giriş kutusu */}
      {digerAktif && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Renk adını yazın"
          autoFocus
          data-testid={testId ? `${testId}-diger` : undefined}
        />
      )}
    </div>
  );
}
