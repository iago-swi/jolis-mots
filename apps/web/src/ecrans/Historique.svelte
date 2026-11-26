<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { atelier } from '../atelier.svelte';
  import { embellir, normaliser, type EntreeHistorique } from '@jolis-mots/core';
  import { annonce, annonceDite, bilan, nombre } from '../bilan';
  import Fiche from '../composants/Fiche.svelte';
  import Pastille from '../composants/Pastille.svelte';
  import { etat } from '../etat.svelte';
  import { verifierMaintenant, type ResultatVerification } from '../miseAJour';
  import { volet } from '../volet';

  type Sorte = 'ajoute' | 'modifie' | 'supprime';
  const SIGNES: Record<Sorte, { signe: string; nom: string }> = {
    ajoute: { signe: '+', nom: 'ajouté' },
    modifie: { signe: '~', nom: 'modifié' },
    supprime: { signe: '−', nom: 'supprimé' },
  };

  const format = new Intl.DateTimeFormat('fr-CH', { dateStyle: 'long', timeStyle: 'short' });

  /**
   * Sur bureau, l'historique lu dans l'histoire de la liste en ligne (conception, section 15.5) ;
   * en l'attendant, ou s'il manque, celui noté sur l'ordinateur.
   */
  let duDepot = $state.raw<EntreeHistorique[] | null>(null);
  let affiche = true;
  onMount(() => {
    atelier
      ?.historiqueDuDepot()
      .then((h) => {
        if (affiche) duDepot = h;
      })
      .catch(() => undefined);
  });
  /** Du plus récent au plus ancien. */
  const entrees = $derived([...(duDepot ?? etat.historique)].reverse());
  // Ouvert depuis l'annonce d'une nouvelle liste : son entrée est dépliée.
  let deplie = $state<string | null>(etat.entreeADeplier);
  etat.entreeADeplier = null;
  /** Les mots encore dans la liste : eux seuls ouvrent une fiche. */
  const presents = $derived(new Set(etat.complets.map((m) => m.id)));
  // La fiche ouverte passe par l'état, comme au Recueil : le bouton retour d'Android la ferme d'abord.
  const ouvert = $derived(etat.ficheOuverte === null ? null : (etat.complets.find((m) => m.id === etat.ficheOuverte) ?? null));
  onDestroy(() => {
    affiche = false;
    etat.ficheOuverte = null;
  });

  function date(publie: string): string {
    const t = Date.parse(publie);
    return Number.isNaN(t) ? publie : format.format(t);
  }

  /** Le bilan dit en toutes lettres, pour les lecteurs d'écran. */
  function bilanDit(e: EntreeHistorique): string {
    const parties: string[] = [];
    const dire = (n: number, s: string, p: string) => parties.push(`${n} ${n > 1 ? p : s}`);
    if (e.ajoutes.length > 0) dire(e.ajoutes.length, 'ajouté', 'ajoutés');
    if (e.modifies.length > 0) dire(e.modifies.length, 'modifié', 'modifiés');
    if (e.supprimes.length > 0) dire(e.supprimes.length, 'supprimé', 'supprimés');
    return `Envoi de l’atelier, ${date(e.publie)} : ${parties.join(', ')} ; ${nombre(e.total)}`;
  }

  /** Les mots de l'entrée, tous ensemble par ordre alphabétique, chacun avec sa sorte. */
  function mots(e: EntreeHistorique): { id: string; mot: string; sorte: Sorte }[] {
    return [
      ...e.ajoutes.map((m) => ({ ...m, sorte: 'ajoute' as const })),
      ...e.modifies.map((m) => ({ ...m, sorte: 'modifie' as const })),
      ...e.supprimes.map((m) => ({ ...m, sorte: 'supprime' as const })),
    ].sort((a, b) => {
      const na = normaliser(a.mot);
      const nb = normaliser(b.mot);
      return na < nb ? -1 : na > nb ? 1 : 0;
    });
  }

  /** « Vérifier maintenant », sur le téléphone seulement : sous Windows, l'atelier reçoit la liste par git. */
  let verification = $state<'en-cours' | ResultatVerification | null>(null);
  /** L'entrée ajoutée par la vérification : son bilan est dit comme dans l'annonce de l'écran Mot. */
  let recue = $state.raw<EntreeHistorique | null>(null);
  const RESULTATS: Record<Exclude<ResultatVerification, 'nouvelle'>, string> = {
    'a-jour': 'La liste est à jour',
    'hors-ligne': 'Pas de connexion. Réessaie plus tard',
  };
  const resultat = $derived(
    verification === null || verification === 'en-cours'
      ? null
      : verification === 'nouvelle'
        ? recue === null
          ? null
          : { texte: annonce(recue), dit: annonceDite(recue) }
        : { texte: RESULTATS[verification], dit: `${RESULTATS[verification]}.` }
  );

  async function verifier(): Promise<void> {
    if (verification === 'en-cours') return;
    verification = 'en-cours';
    const r = await verifierMaintenant();
    // Écran quitté entre-temps : l'annonce, elle, dira la nouvelle liste sur l'écran Mot.
    if (!affiche) return;
    // L'historique, ouvert, montre déjà la nouvelle entrée et son bilan : pas d'annonce en plus.
    etat.fermerAnnonce();
    recue = r === 'nouvelle' ? (etat.historique[etat.historique.length - 1] ?? null) : null;
    verification = r;
    if (recue !== null) deplie = recue.publie;
  }

  function basculer(publie: string): void {
    deplie = deplie === publie ? null : publie;
  }

</script>

<div class="historique" inert={ouvert !== null}>
  <div class="defilement">
    <header class="titre">
      <button class="retour" onclick={() => etat.allerA('reglages')}>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"></path></svg>
        Réglages
      </button>
      <h1>Historique de la liste</h1>
    </header>

    {#if atelier === null}
      <div class="verifier">
        <button class="secondaire" disabled={verification === 'en-cours'} onclick={verifier}>
          {verification === 'en-cours' ? 'Vérification…' : 'Vérifier maintenant'}
        </button>
        <!-- Même aspect que l'annonce de l'écran Mot ; la phrase en toutes lettres est dite par la zone d'état. -->
        <span class="visuel-cache" role="status">{resultat?.dit ?? ''}</span>
        {#if resultat !== null}
          <span aria-hidden="true"><Pastille>{resultat.texte}</Pastille></span>
        {/if}
      </div>
    {/if}

    <ol class="entrees">
      {#each entrees as e (e.publie)}
        <li class="entree">
          {#if e.debut}
            <div class="tete">
              <span class="origine">Début de l’historique</span>
              <span class="date">{date(e.publie)}</span>
              <span class="bilan">{nombre(e.total)}</span>
            </div>
          {:else}
            <button class="tete depliable" aria-expanded={deplie === e.publie} aria-label={bilanDit(e)} onclick={() => basculer(e.publie)}>
              <span class="origine">Envoi de l’atelier</span>
              <span class="date">{date(e.publie)}</span>
              <span class="bilan">{bilan(e)} <span class="fleche" aria-hidden="true">→</span> {nombre(e.total)}</span>
              <svg class="chevron" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"></path></svg>
            </button>
            {#if deplie === e.publie}
              <ul class="mots">
                {#each mots(e) as m (m.sorte + m.id)}
                  <li class={m.sorte}>
                    <span class="signe" aria-hidden="true">{SIGNES[m.sorte].signe}</span>
                    {#if m.sorte !== 'supprime' && presents.has(m.id)}
                      <button class="mot" onclick={() => (etat.ficheOuverte = m.id)}>{embellir(m.mot)}</button>
                    {:else}
                      <span class="mot">{embellir(m.mot)}</span>
                    {/if}
                    <span class="visuel-cache">({SIGNES[m.sorte].nom})</span>
                  </li>
                {/each}
              </ul>
            {/if}
          {/if}
        </li>
      {/each}
    </ol>
  </div>
</div>

{#if ouvert !== null}
  <div class="volet" role="dialog" aria-modal="true" aria-label="Fiche du mot" use:volet={{ fermer: () => (etat.ficheOuverte = null) }}>
    <div class="defilement"><Fiche mot={ouvert} /></div>
    <div class="actions">
      <button class="principal" data-depart onclick={() => (etat.ficheOuverte = null)}>Retour à l’historique</button>
    </div>
  </div>
{/if}

<style>
  .historique {
    flex-grow: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .defilement {
    flex-grow: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 14px 28px 24px;
  }

  .titre {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }

  h1 {
    margin: 0;
    font-size: 34px;
    font-weight: 500;
  }

  .retour {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 44px;
    margin-left: -8px;
    padding: 0 8px;
    border: none;
    background: transparent;
    font-size: 17px;
    color: var(--second);
    cursor: pointer;
  }

  ol,
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* La pastille sous le bouton : le bilan d'une nouvelle liste ne tiendrait pas à côté sur un téléphone. */
  .verifier {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    margin-top: 16px;
  }

  .secondaire {
    flex-shrink: 0;
    height: 40px;
    padding: 0 18px;
    border: 1px solid var(--encre);
    border-radius: 20px;
    background: transparent;
    color: var(--encre);
    font: inherit;
    font-size: 16px;
    cursor: pointer;
  }

  .secondaire:disabled {
    color: var(--second);
    border-color: var(--filet);
    cursor: default;
  }

  .entrees {
    margin-top: 20px;
  }

  .entree {
    border-top: 1px solid var(--filet);
  }

  .tete {
    position: relative;
    display: grid;
    grid-template-columns: 1fr;
    gap: 2px;
    width: 100%;
    min-height: 44px;
    padding: 12px 28px 12px 0;
    border: none;
    background: transparent;
    color: var(--encre);
    font: inherit;
    text-align: left;
  }

  .depliable {
    cursor: pointer;
  }

  .origine {
    font-size: 13px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--second);
  }

  .date {
    font-size: 19px;
  }

  .bilan {
    font-size: 17px;
    font-style: italic;
    color: var(--second);
  }

  .fleche {
    font-style: normal;
  }

  .chevron {
    position: absolute;
    right: 0;
    top: 50%;
    margin-top: -9px;
    color: var(--second);
  }

  [aria-expanded='true'] .chevron {
    transform: rotate(90deg);
  }

  /* Une simple information : petite, serrée. */
  .mots {
    padding: 0 0 10px;
    font-size: 15px;
    line-height: 1.35;
  }

  .mots li {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .signe {
    width: 10px;
    flex-shrink: 0;
    text-align: center;
    color: var(--second);
  }

  .mot {
    padding: 0;
    border: none;
    background: transparent;
    font: inherit;
    color: var(--encre);
    text-align: left;
  }

  button.mot {
    cursor: pointer;
  }

  .supprime .mot {
    color: var(--second);
  }

  .visuel-cache {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .volet {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: var(--papier);
  }

  .volet .defilement {
    padding: 46px 28px 24px;
  }

  .actions {
    display: flex;
    padding: 14px 28px 18px;
  }

  .principal {
    flex: 1 1 0;
    height: 52px;
    border: none;
    border-radius: 26px;
    background: var(--encre);
    color: var(--papier);
    font-size: 19px;
    cursor: pointer;
  }

  @media (prefers-reduced-motion: no-preference) {
    .chevron {
      transition: transform 0.15s ease;
    }
  }
</style>
