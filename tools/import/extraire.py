"""Extrait la feuille « Philippe » de vocabulaire.xlsx en un tableau JSON de LigneExcel.

Usage : python -I tools/import/extraire.py <xlsx> <sortie.json>
Le classeur est ouvert en lecture seule et n'est jamais enregistré.
"""
import json
import sys
import warnings
from pathlib import Path

import openpyxl

COLONNES = ['mot', 'tri', 'genre', 'definition', 'note', 'util', 'source']
ROUGE = 'FFFF0000'


def en_texte(valeur):
    if valeur is None:
        return ''
    if isinstance(valeur, float) and valeur.is_integer():
        return str(int(valeur))
    return str(valeur)


def est_rouge(cellule):
    remplissage = cellule.fill
    return bool(remplissage is not None and remplissage.fill_type and remplissage.fgColor.rgb == ROUGE)


def main():
    if len(sys.argv) != 3:
        sys.exit('Usage : python -I tools/import/extraire.py <xlsx> <sortie.json>')
    source, sortie = Path(sys.argv[1]), Path(sys.argv[2])
    with warnings.catch_warnings():
        warnings.simplefilter('ignore')
        classeur = openpyxl.load_workbook(source, read_only=True, data_only=True)
    feuille = classeur['Philippe']
    lignes = []
    for rangee in feuille.iter_rows(min_row=2, max_col=7):
        valeurs = [en_texte(c.value) for c in rangee]
        if all(v.strip() == '' for v in valeurs):
            continue
        ligne = dict(zip(COLONNES, valeurs))
        ligne['rouge'] = est_rouge(rangee[0])
        lignes.append(ligne)
    classeur.close()
    sortie.parent.mkdir(parents=True, exist_ok=True)
    sortie.write_text(json.dumps(lignes, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'{len(lignes)} lignes extraites vers {sortie}')


if __name__ == '__main__':
    main()
