import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, HostListener, OnInit, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map, shareReplay, switchMap } from 'rxjs/operators';
import {
  bulbapediaAnchorForMegaLike,
  formatMegaFormDisplayName,
  isMegaLikeFormName
} from '../../data/mega-forms';
import { PokemonService } from '../../services/pokemon-service/pokemon.service';
import { PokedexUiService } from '../../services/pokedex-ui.service';

type PokedexRow = {
  id: number;
  name: string;
  power: number;
  imgUrl: string;
  loading: boolean;
  heightM?: number;
  weightKg?: number;
  descriptionEn?: string;

  types?: string[];
  baseId?: number;
  formLabel?: string;
  megaForms?: string[];
  regionalForms?: string[];
};

type FormInfo = {
  title: string;
  kind: 'mega' | 'regional' | 'form';
  spriteUrl?: string;
  types: string[];
  power?: number;
  descriptionEn?: string;
  bulbapediaUrl?: string;
  pokeapiUrl?: string;

  // Same fields the dex cards show, so the popup can reuse their layout.
  dexNo?: number;
  heightM?: number;
  weightKg?: number;
};

@Component({
  selector: 'app-pokedex-screen',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './pokedex-screen.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './pokedex-screen.component.css'
})
export class PokedexScreenComponent implements OnInit {
  private apiBaseUrl = 'https://pokeapi.co/api/v2';

  search = '';

  selectedType = '';
  readonly allTypes: string[] = [
    'normal','fire','water','electric','grass','ice','fighting','poison','ground','flying',
    'psychic','bug','rock','ghost','dragon','dark','steel','fairy'
  ];
  private typeIndexCache = new Map<string, Set<number>>();

  pageSize = 48;
  pageIndex = 0;

  allRows: PokedexRow[] = [];
  visibleRows: PokedexRow[] = [];

  private pokemonCache = new Map<number, { heightM: number; weightKg: number; types: string[] }>();
  private speciesCache = new Map<number, { descriptionEn: string; megaForms: string[]; regionalForms: string[] }>();
  private customMegaForms$?: Observable<Map<number, string[]>>;

  megaSelectForms: string[] = [];
  megaSelectForName: string = '';
  megaSelectBasePower: number = 1;
  megaSelectOpen: boolean = false;

  formInfo: FormInfo | null = null;

  @ViewChild('screenRoot', { static: true }) screenRoot!: ElementRef<HTMLElement>;

  /** Screen-space box of the Pokédex itself; the popup is clamped to it. */
  popupBox = { left: 0, width: 0 };

  constructor(
    private http: HttpClient,
    private pokemonService: PokemonService,
    private pokedexUi: PokedexUiService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    const dex = this.pokemonService.getAllPokemon()
      .slice()
      .sort((a, b) => a.pokemonId - b.pokemonId);

    this.allRows = dex.map((p) => {
      const id = p.pokemonId;
      const baseId = p.basePokemonId;
      const formLabel = baseId ? this.detectFormLabel(p.text) : undefined;

      return {
        id,
        name: this.prettyName(p.text),
        power: (p as any).power ?? 1,
        imgUrl: this.officialArtworkUrl(id),
        loading: false,
        baseId,
        formLabel
      };
    });

    this.refreshVisibleRows();
  }

  closePokedex(): void {
    this.pokedexUi.close();
  }

  onSearchChange(): void {
    this.pageIndex = 0;
    this.refreshVisibleRows();
  }

  onTypeChange(): void {
    this.pageIndex = 0;
    if (!this.selectedType) {
      this.refreshVisibleRows();
      return;
    }
    this.ensureTypeIndex(this.selectedType).subscribe({
      next: () => this.refreshVisibleRows(),
      error: () => this.refreshVisibleRows()
    });
  }

  prevPage(): void {
    if (this.pageIndex > 0) {
      this.pageIndex -= 1;
      this.refreshVisibleRows();
    }
  }

  nextPage(): void {
    const maxPage = Math.max(0, Math.ceil(this.filteredRows().length / this.pageSize) - 1);
    if (this.pageIndex < maxPage) {
      this.pageIndex += 1;
      this.refreshVisibleRows();
    }
  }

  pageLabel(): string {
    const total = this.filteredRows().length;
    const from = total === 0 ? 0 : this.pageIndex * this.pageSize + 1;
    const to = Math.min(total, (this.pageIndex + 1) * this.pageSize);
    return `${from}–${to} / ${total}`;
  }

  openMegaChip(row: any): void {
    const forms: string[] = row?.megaForms ?? [];
    if (forms.length === 0) return;

    if (forms.length === 1) {
      this.openFormDetails(forms[0], 'mega', row?.power);
      return;
    }

    this.megaSelectForms = forms.slice();
    this.megaSelectForName = row?.name ?? '';
    this.megaSelectBasePower = row?.power ?? 1;
    this.formInfo = null;
    this.syncPopupBox();
    this.megaSelectOpen = true;
  }

  filteredRows(): PokedexRow[] {
    const q = this.search.trim().toLowerCase();
    const type = (this.selectedType || '').trim().toLowerCase();
    const typeSet = type ? this.typeIndexCache.get(type) : undefined;

    let rows = this.allRows;
    if (type && typeSet) {
      rows = rows.filter((r) => typeSet.has(r.baseId ?? r.id) || typeSet.has(r.id));
    }

    if (!q) return rows;

    const idQuery = Number(q);
    if (!Number.isNaN(idQuery) && idQuery > 0) {
      return rows.filter((r) => r.id === idQuery || (r.baseId === idQuery));
    }

    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }

  private refreshVisibleRows(): void {
    const rows = this.filteredRows();
    const start = this.pageIndex * this.pageSize;
    this.visibleRows = rows.slice(start, start + this.pageSize);
    this.loadDetailsForVisibleRows();
  }

  private loadDetailsForVisibleRows(): void {
    const toLoad = this.visibleRows.filter((r) => !this.pokemonCache.has(r.id) || !this.speciesCache.has(r.baseId ?? r.id));
    if (toLoad.length === 0) return;

    toLoad.forEach((row) => (row.loading = true));

    const pokemonRequests = toLoad.map((row) =>
      this.fetchPokemon(row.id).pipe(
        catchError(() => of({ heightM: 0, weightKg: 0, types: [] })),
        map((p) => ({ id: row.id, ...p }))
      )
    );

    const speciesRequests = toLoad.map((row) => {
      const sid = row.baseId ?? row.id;
      return this.fetchSpecies(sid).pipe(
        catchError(() =>
          of({ descriptionEn: '', megaForms: [] as string[], regionalForms: [] as string[] })
        ),
        map((s) => ({ sid, ...s }))
      );
    });

    forkJoin([
      forkJoin(pokemonRequests),
      forkJoin(speciesRequests),
      this.customMegaFormsByBaseId()
    ]).subscribe({
      next: ([pokemons, species, customMegas]) => {
        for (const p of pokemons) {
          this.pokemonCache.set(p.id, { heightM: p.heightM, weightKg: p.weightKg, types: p.types });
        }
        for (const s of species) {
          const extra = (customMegas.get(s.sid) ?? []).filter((n) => !s.megaForms.includes(n));
          const megaForms = [...s.megaForms, ...extra].sort((a, b) =>
            formatMegaFormDisplayName(a).localeCompare(formatMegaFormDisplayName(b))
          );
          this.speciesCache.set(s.sid, { descriptionEn: s.descriptionEn, megaForms, regionalForms: s.regionalForms });
        }

        for (const row of this.visibleRows) {
          const p = this.pokemonCache.get(row.id);
          const s = this.speciesCache.get(row.baseId ?? row.id);
          if (p) {
            row.heightM = p.heightM;
            row.weightKg = p.weightKg;
            row.types = p.types;
          }
          if (s) {
            row.descriptionEn = s.descriptionEn;
            row.megaForms = s.megaForms;
            row.regionalForms = s.regionalForms;
          }
          row.loading = false;
        }
      },
      error: () => {
        for (const row of this.visibleRows) row.loading = false;
      }
    });
  }

  megaPowerFor(basePower: number): number {
    return basePower === 5 ? 6 : 5;
  }

  private resolveFormPower(kind: 'mega' | 'regional' | 'form', basePower?: number): number | undefined {
    if (basePower === undefined || basePower === null) return undefined;
    return kind === 'mega' ? this.megaPowerFor(basePower) : basePower;
  }

  openFormDetails(formName: string, kind: 'mega' | 'regional' | 'form' = 'form', basePower?: number): void {
    const slug = formName.trim().toLowerCase();
    const resolvedPower = this.resolveFormPower(kind, basePower);

    // Close any other inline panels
    this.megaSelectOpen = false;

    this.fetchPokemonByNameWithFallback(slug).pipe(
      switchMap((poke) => {
        const types = (poke?.types || []).map((t: any) => t?.type?.name).filter(Boolean);
        const spriteUrl =
          poke?.sprites?.other?.['official-artwork']?.front_default ||
          poke?.sprites?.front_default ||
          '';

        // Mirrors fetchPokemon() so the popup can render the same stat line as the cards.
        const common = {
          kind,
          spriteUrl,
          types,
          power: resolvedPower,
          dexNo: typeof poke?.id === 'number' ? poke.id : undefined,
          heightM: (poke?.height ?? 0) / 10,
          weightKg: (poke?.weight ?? 0) / 10,
          bulbapediaUrl: this.bulbapediaUrlFor(formName, kind),
          pokeapiUrl: `${this.apiBaseUrl}/pokemon/${slug}`
        };

        const speciesUrl = poke?.species?.url as string | undefined;
        if (!speciesUrl) {
          return of({
            ...common,
            title: this.formTitle(formName, kind),
            descriptionEn: ''
          } as FormInfo);
        }

        return this.http.get<any>(speciesUrl).pipe(
          catchError(() => of(null)),
          map((sp) => ({
            ...common,
            title: this.formTitle(formName, kind),
            descriptionEn: this.pickFlavorText(sp)
          } as FormInfo))
        );
      }),
      catchError(() => of(null))
    ).subscribe((info) => {
      if (!info) return;
      this.syncPopupBox();
      this.formInfo = info;
    });
  }

  chooseMegaForm(formName: string): void {
    this.megaSelectOpen = false;
    this.openFormDetails(formName, 'mega', this.megaSelectBasePower);
  }

  closeFormInfo(): void {
    this.formInfo = null;
  }

  closeMegaSelect(): void {
    this.megaSelectOpen = false;
  }

  /** True while either popup (mega picker or form details) is showing. */
  get isPopupOpen(): boolean {
    return this.megaSelectOpen || !!this.formInfo;
  }

  closePopup(): void {
    this.megaSelectOpen = false;
    this.formInfo = null;
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isPopupOpen) this.closePopup();
  }

  /**
   * The Pokédex is a narrow column on desktop, so a viewport-centred dialog would hang
   * over the roulette. Measure the Pokédex box and pin the popup to it instead.
   */
  @HostListener('window:resize')
  syncPopupBox(): void {
    const el = this.screenRoot?.nativeElement;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    this.popupBox = { left: Math.round(rect.left), width: Math.round(rect.width) };
  }

  displayFormName(formName: string): string {
    return formatMegaFormDisplayName(formName);
  }

  private fetchPokemon(id: number) {
    const url = `${this.apiBaseUrl}/pokemon/${id}`;
    return this.http.get<any>(url).pipe(
      map((data) => {
        const heightM = (data.height ?? 0) / 10;
        const weightKg = (data.weight ?? 0) / 10;
        const types = (data.types ?? []).map((t: any) => t?.type?.name).filter(Boolean);
        return { heightM, weightKg, types };
      })
    );
  }

  private fetchSpecies(speciesId: number) {
    const url = `${this.apiBaseUrl}/pokemon-species/${speciesId}`;
    return this.http.get<any>(url).pipe(
      map((data) => {
        const descriptionEn = this.pickFlavorText(data);

        const varieties: string[] = (data?.varieties ?? [])
          .map((v: any) => v?.pokemon?.name)
          .filter((n: any) => typeof n === 'string');

        // Same rule the Mega roulette uses, so the Pokédex lists exactly what the game
        // can actually give you — including Primal Kyogre/Groudon and Ultra Necrozma.
        const megaForms = varieties.filter((n) => isMegaLikeFormName(n));
        const regionalForms = varieties.filter((n) => /-(alola|galar|hisui|paldea)\b/.test(n));

        return { descriptionEn, megaForms, regionalForms };
      })
    );
  }

  /**
   * Fan/custom Mega forms live in public/data/custom-mega-forms.json and are not PokeAPI
   * varieties, so the species request above can't see them. Merge them in by base species
   * id, otherwise the Pokédex would under-report what the Mega roulette offers.
   */
  private customMegaFormsByBaseId(): Observable<Map<number, string[]>> {
    if (this.customMegaForms$) return this.customMegaForms$;

    const url = new URL('data/custom-mega-forms.json', document.baseURI).toString();

    this.customMegaForms$ = this.http.get<any>(url).pipe(
      map((file) => {
        const byBaseId = new Map<number, string[]>();
        for (const def of file?.forms ?? []) {
          const baseId = Number(def?.basePokemonId);
          const apiName = (def?.apiName ?? '').toString().trim().toLowerCase();
          if (!Number.isFinite(baseId) || baseId <= 0 || !apiName) continue;
          if (!isMegaLikeFormName(apiName)) continue;

          const list = byBaseId.get(baseId) ?? [];
          if (!list.includes(apiName)) list.push(apiName);
          byBaseId.set(baseId, list);
        }
        return byBaseId;
      }),
      catchError(() => of(new Map<number, string[]>())),
      shareReplay(1)
    );

    return this.customMegaForms$;
  }

  /**
   * Flavour text in the player's language when PokeAPI has it, English otherwise.
   *
   * Heads-up: PokeAPI registers "pt-br" as a language but ships no Portuguese flavour
   * text at all (0 of the species sampled), so today this always resolves to English.
   * The lookup is written as a preference list so it starts working on its own if that
   * ever changes.
   */
  private pickFlavorText(speciesData: any): string {
    const entries: any[] = speciesData?.flavor_text_entries ?? [];

    const preferred = this.translate.currentLang() === 'pt-BR' ? ['pt-br', 'en'] : ['en'];
    const entry =
      preferred.map((lang) => entries.find((e) => e?.language?.name === lang)).find(Boolean) ??
      entries[0];

    const txt = (entry?.flavor_text || '') as string;
    return txt.replace(/\f/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private ensureTypeIndex(type: string) {
    const t = (type || '').trim().toLowerCase();
    if (!t) return of(null);
    if (this.typeIndexCache.has(t)) return of(null);

    const url = `${this.apiBaseUrl}/type/${t}`;
    return this.http.get<any>(url).pipe(
      map((data) => {
        const set = new Set<number>();
        const arr: any[] = data?.pokemon ?? [];
        for (const entry of arr) {
          const purl = entry?.pokemon?.url as string | undefined;
          if (!purl) continue;
          const m = purl.match(/\/pokemon\/(\d+)\//);
          if (m) set.add(Number(m[1]));
        }
        this.typeIndexCache.set(t, set);
        return null;
      }),
      catchError(() => of(null))
    );
  }

  private fetchPokemonByNameWithFallback(name: string) {
    const url = `${this.apiBaseUrl}/pokemon/${encodeURIComponent(name)}`;
    return this.http.get<any>(url).pipe(
      catchError(() => {
        let alt = name;
        alt = alt.replace(/-megax$/, '-mega-x');
        alt = alt.replace(/-megay$/, '-mega-y');
        const url2 = `${this.apiBaseUrl}/pokemon/${encodeURIComponent(alt)}`;
        return this.http.get<any>(url2);
      })
    );
  }

  private detectFormLabel(textKey: string): string | undefined {
    const key = (textKey || '').toLowerCase();
    if (key.includes('alola')) return 'Alola';
    if (key.includes('galar')) return 'Galar';
    if (key.includes('hisui')) return 'Hisui';
    if (key.includes('paldea')) return 'Paldea';
    return 'Regional';
  }

  private officialArtworkUrl(id: number): string {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
  }

  private prettyName(raw: string): string {
    const s = raw.startsWith('pokemon.') ? raw.substring('pokemon.'.length) : raw;
    return s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /** Megas/Primals/Ultra read prefix-first; other forms keep the plain slug spelling. */
  private formTitle(formName: string, kind: 'mega' | 'regional' | 'form'): string {
    return kind === 'mega' ? formatMegaFormDisplayName(formName) : this.prettyName(formName);
  }

  private bulbapediaUrlFor(formName: string, kind: 'mega' | 'regional' | 'form'): string {
    const n = formName.trim().toLowerCase();
    const parts = n.split('-').filter(Boolean);
    const base = parts[0] ? (parts[0].charAt(0).toUpperCase() + parts[0].slice(1)) : 'Pok%C3%A9mon';

    if (kind !== 'mega') {
      return `https://bulbapedia.bulbagarden.net/wiki/${encodeURIComponent(base)}`;
    }

    // Primal Reversion and Ultra Burst live under their own headings, not "#Mega_Evolution".
    const anchor = bulbapediaAnchorForMegaLike(n);
    return `https://bulbapedia.bulbagarden.net/wiki/${encodeURIComponent(base)}#${anchor}`;
  }
}
