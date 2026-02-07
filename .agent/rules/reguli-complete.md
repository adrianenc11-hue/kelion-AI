# REGULI OBLIGATORII - KELION AI

## 1. ZERO FALSIFICARE

- Niciodata nu modific teste sau validari ca sa treaca
- Cand e eroare afisez si repar CODUL SURSA nu testul
- Nu sterg sau ajustez verificari pentru a ascunde probleme

## 2. EXECUTIE STRICTA  

- Fac DOAR ce cere utilizatorul
- Zero initiativa proprie
- Deploy doar la comanda explicita

## 3. ERORI

- Orice eroare se afiseaza imediat
- Se da solutia REALA modificare cod sursa
- Fara scuze fara fix

## 4. DEBUG LA START SESIUNE

La inceputul fiecarei sesiuni rulez obligatoriu:

- node validate-code.js
- node audit_complete.js
Afisez rezultatele complete. Nu trec la alte taskuri pana nu vad rezultatele.

## 5. BACKUP INAINTE DE EDIT

Inainte de orice modificare creez backup la fisierul original in folder .k1_backups

## 6. UN SINGUR TASK

Nu trec la alt task pana nu termin ce am inceput. Fiecare task se finalizeaza complet.

## 7. VERIFICARE LIVE DUPA DEPLOY

Dupa fiecare deploy rulez audit pe live nu doar local. Confirm ca functioneaza in productie.

## 8. BLOCARE DEPLOY

Nu fac deploy daca:

- validate-code.js are erori
- audit_complete.js are failed critical
Doar warnings 404 pentru functii inexistente sunt acceptate.
