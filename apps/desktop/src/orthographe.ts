// Le dictionnaire français du correcteur de Windows, pour le vérificateur de l'atelier
// (conception, section 15.4). Node seul, sans Electron.
//
// Pourquoi pas `webFrame.isWordMisspelled` dans le preload : sous Windows, Chromium confie le
// soulignement au correcteur du système, et `isWordMisspelled` (qui ne connaît que les
// dictionnaires Hunspell) rend toujours faux. Le processus principal n'a pas d'API pour juger un
// mot. Il interroge donc le même correcteur de Windows (ISpellChecker) par un PowerShell lancé une
// fois, sans shell : les mots passent par l'entrée standard, en JSON, jamais sur la ligne de commande.
// Aucune fonction ne lève : sans PowerShell ou sans dictionnaire français, aucun mot n'est inconnu.

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { join } from 'node:path';

/** Le programme : celui de Windows, par son chemin complet, jamais cherché dans le PATH. */
export const POWERSHELL = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
/** Les langues essayées, dans l'ordre : `fr` d'abord, comme le correcteur de la fenêtre. */
const LANGUES = ['fr', 'fr-FR', 'fr-CH'];
/** Le démarrage compile un peu de C# : il peut prendre quelques secondes. */
const DELAI_DEMARRAGE = 60_000;
const DELAI_DEMANDE = 30_000;
/** Au-delà, un mot n'est pas jugé (ce n'en est pas un). */
const LONGUEUR_MAX = 64;
const MOTS_MAX = 2000;

/** Le programme PowerShell : il ouvre le correcteur, puis juge chaque lot de mots reçu. */
const PROGRAMME = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
namespace JolisMots {
  [ComImport, Guid("8E018A9D-2415-4677-BF08-794EA61F94BB"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface ISpellCheckerFactory {
    IEnumString SupportedLanguages { get; }
    int IsSupported([MarshalAs(UnmanagedType.LPWStr)] string languageTag);
    ISpellChecker CreateSpellChecker([MarshalAs(UnmanagedType.LPWStr)] string languageTag);
  }
  [ComImport, Guid("B6FD0B71-E2BC-4653-8D05-F197E412770B"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface ISpellChecker {
    string LanguageTag { [return: MarshalAs(UnmanagedType.LPWStr)] get; }
    IEnumSpellingError Check([MarshalAs(UnmanagedType.LPWStr)] string text);
  }
  [ComImport, Guid("803E3BD4-2828-4410-8290-418D1D73C762"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IEnumSpellingError {
    [PreserveSig] int Next(out ISpellingError value);
  }
  [ComImport, Guid("B7C82D61-FBE8-4B47-9B27-6C0D2E0DE0A3"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface ISpellingError {
    uint StartIndex { get; }
    uint Length { get; }
  }
  [ComImport, Guid("7AB36653-1796-484B-BDFA-E74F1DB7C1DC")]
  public class SpellCheckerFactory { }
  public static class Correcteur {
    static ISpellChecker c;
    public static string Ouvrir(string[] langues) {
      var f = (ISpellCheckerFactory)new SpellCheckerFactory();
      foreach (var l in langues) {
        if (f.IsSupported(l) != 0) { c = f.CreateSpellChecker(l); return l; }
      }
      return null;
    }
    public static bool Inconnu(string mot) {
      var e = c.Check(mot);
      ISpellingError err;
      bool faute = false;
      while (e.Next(out err) == 0) { faute = true; Marshal.ReleaseComObject(err); }
      Marshal.ReleaseComObject(e);
      return faute;
    }
  }
}
'@
$langue = [JolisMots.Correcteur]::Ouvrir([string[]](${JSON.stringify(LANGUES).replace(/^\[|\]$/g, '')}))
if ($null -eq $langue) { [Console]::Out.WriteLine('SANS'); [Console]::Out.Flush(); exit 0 }
[Console]::Out.WriteLine('PRET ' + $langue); [Console]::Out.Flush()
while ($true) {
  $ligne = [Console]::In.ReadLine()
  if ($null -eq $ligne) { break }
  # Une demande qui échoue reçoit une réponse vide ; le programme continue.
  try {
    $mots = $ligne | ConvertFrom-Json
    $fautes = New-Object System.Collections.Generic.List[int]
    for ($i = 0; $i -lt $mots.Count; $i++) { if ([JolisMots.Correcteur]::Inconnu([string]$mots[$i])) { $fautes.Add($i) } }
    [Console]::Out.WriteLine('[' + ($fautes -join ',') + ']'); [Console]::Out.Flush()
  } catch {
    [Console]::Out.WriteLine('[]'); [Console]::Out.Flush()
  }
}
`;

/**
 * Les arguments de PowerShell. Pas de « -ExecutionPolicy » : la stratégie ne vise que les fichiers
 * de script, et le programme n'en charge aucun (il passe par « -EncodedCommand »).
 */
export function argumentsPowerShell(): string[] {
  return ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(PROGRAMME, 'utf16le').toString('base64')];
}

/** Le JSON des mots, en ASCII seul : aucune page de codes ne peut l'abîmer en route. */
function enAscii(mots: string[]): string {
  return JSON.stringify(mots).replace(/[^\x20-\x7e]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

export interface Correcteur {
  /** Les mots inconnus du dictionnaire, dans l'ordre reçu ; aucun si le correcteur manque. */
  inconnus(mots: string[]): Promise<string[]>;
  /** La langue du dictionnaire ouvert ; null tant qu'il ne l'est pas, ou s'il n'y en a pas. */
  readonly langue: string | null;
  fermer(): void;
}

export interface OptionsCorrecteur {
  powershell?: string;
}

/** Le correcteur, lancé à la première demande ; les demandes passent une à une. */
export function creerCorrecteur(options: OptionsCorrecteur = {}): Correcteur {
  let enfant: ChildProcessWithoutNullStreams | null = null;
  let horsService = false;
  let langue: string | null = null;
  let tampon = '';
  /** Qui attend la prochaine ligne de PowerShell. */
  let attente: ((ligne: string | null) => void) | null = null;
  let file: Promise<unknown> = Promise.resolve();

  /** Met le correcteur hors service pour la session ; `cause` est dite dans le journal, une fois. */
  function arreter(cause: string | null): void {
    if (cause !== null && !horsService) console.error(`Correcteur d'orthographe hors service\u202F: ${cause}`);
    horsService = true;
    const e = enfant;
    enfant = null;
    if (e !== null && e.exitCode === null) e.kill();
    attente?.(null);
    attente = null;
  }

  /** La prochaine ligne écrite par PowerShell ; null s'il s'arrête ou ne répond pas à temps. */
  function ligneSuivante(delai: number): Promise<string | null> {
    return new Promise((resoudre) => {
      const minuterie = setTimeout(() => {
        attente = null;
        arreter(`pas de réponse de PowerShell en ${delai / 1000} s`);
        resoudre(null);
      }, delai);
      attente = (ligne) => {
        clearTimeout(minuterie);
        resoudre(ligne);
      };
      lireTampon();
    });
  }

  function lireTampon(): void {
    const fin = tampon.indexOf('\n');
    if (fin === -1 || attente === null) return;
    const ligne = tampon.slice(0, fin).trim();
    tampon = tampon.slice(fin + 1);
    const a = attente;
    attente = null;
    a(ligne);
  }

  async function demarrer(): Promise<boolean> {
    if (enfant !== null) return true;
    if (horsService) return false;
    try {
      const e = spawn(
        options.powershell ?? POWERSHELL,
        argumentsPowerShell(),
        { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
      );
      enfant = e;
      e.stdout.setEncoding('utf8');
      e.stdout.on('data', (morceau: string) => {
        tampon += morceau;
        lireTampon();
      });
      // PowerShell écrit sa progression sur l'erreur standard : elle est lue et jetée.
      e.stderr.resume();
      e.stdin.on('error', () => undefined);
      e.on('error', (erreur) => arreter(`PowerShell ne démarre pas (${erreur.message})`));
      e.on('exit', (code, signal) => {
        if (enfant === e) arreter(`PowerShell s'est arrêté (code ${code ?? signal})`);
      });
    } catch (erreur) {
      arreter(`PowerShell ne démarre pas (${erreur instanceof Error ? erreur.message : String(erreur)})`);
      return false;
    }
    const tete = await ligneSuivante(DELAI_DEMARRAGE);
    if (tete === null || !tete.startsWith('PRET ')) {
      arreter(tete === 'SANS' ? 'pas de dictionnaire français dans Windows' : `réponse inattendue au démarrage (${tete ?? 'aucune'})`);
      return false;
    }
    langue = tete.slice('PRET '.length);
    return true;
  }

  async function juger(mots: string[]): Promise<string[]> {
    if (mots.length === 0 || !(await demarrer()) || enfant === null) return [];
    enfant.stdin.write(`${enAscii(mots)}\n`);
    const reponse = await ligneSuivante(DELAI_DEMANDE);
    if (reponse === null) return [];
    try {
      const indices: unknown = JSON.parse(reponse);
      if (!Array.isArray(indices)) return [];
      return indices.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < mots.length).map((i) => mots[i]!);
    } catch {
      arreter(`réponse illisible (${reponse.slice(0, 80)})`);
      return [];
    }
  }

  return {
    get langue() {
      return langue;
    },
    inconnus(mots: string[]): Promise<string[]> {
      const valides = (Array.isArray(mots) ? mots : [])
        .slice(0, MOTS_MAX)
        .filter((m): m is string => typeof m === 'string' && m.length > 0 && m.length <= LONGUEUR_MAX && !/[\r\n]/.test(m));
      const suite = file.then(() => juger(valides)).catch(() => []);
      file = suite;
      return suite;
    },
    fermer(): void {
      arreter(null);
    },
  };
}
