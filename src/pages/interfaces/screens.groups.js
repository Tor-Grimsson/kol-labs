// Screen categories — content groupings for the gallery browser (mirrors the
// widget GROUPS in widgets/groups.js). Every screen id belongs to exactly one
// group. Kept dependency-free so the eager sidebar config can import it without
// pulling in the heavy screens.js (widgets, cipher, clock).
export const SCREEN_GROUPS = [
  { key: 'synth', label: 'Synths', ids: ['01', '05', '06', '07', '10', '34', '36', '39'] },
  { key: 'bio', label: 'Bio', ids: ['08', '12', '13', '14', '15', '17', '18', '20', '31', '32'] },
  { key: 'data', label: 'Data', ids: ['02', '03', '04', '09', '11', '21', '23', '25', '28', '30', '35', '37'] },
  { key: 'icon', label: 'Icons', ids: ['22', '24', '26', '29', '33', '38'] },
  { key: 'deck', label: 'Decks', ids: ['16', '19', '27', '40'] },
  { key: 'creature', label: 'Creatures', ids: ['41', '42', '43', '44', '45', '46', '47', '48', '49', '50'] },
]

export const screenCat = (id) => SCREEN_GROUPS.find((g) => g.ids.includes(id))?.key || null
