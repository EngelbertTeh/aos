const adjectives = [
    "Digha",      // long
    "Rassa",      // short
    "Mahā",       // great
    "Culla",      // small/minor
    "Seta",       // white
    "Kāla",       // black/dark
    "Lohita",     // red
    "Pīta",       // yellow
    "Nīla",       // blue/dark
    "Odāta",      // white/pale
    "Thūla",      // thick/coarse
    "Tanu",       // thin
    "Daha",       // young/fresh
    "Jara",       // old/aged
    "Sukha",      // pleasant/soft
    "Dukkha",     // hard/painful
    "Vaṇṇa",      // colored
    "Rukkha",     // dry/rough
];

const names = [
    "Kesa",       // head hair
    "Loma",       // body hair
    "Nakha",      // nails
    "Danta",      // teeth
    "Taco",       // skin
    "Maṁsa",      // flesh
    "Nhāru",      // sinew
    "Aṭṭhi",      // bone
    "Aṭṭhimiñja", // bone marrow
    "Vakka",      // kidney
    "Hadaya",     // heart
    "Yakana",     // liver
    "Kilomaka",   // membrane/pleura
    "Pihaka",     // spleen
    "Papphāsa",   // lungs
    "Anta",       // intestines
    "Antaguṇa",   // mesentery
    "Udariya",    // stomach contents
    "Karīsa",     // feces
    "Pitta",      // bile
    "Semha",      // phlegm
    "Pubbo",      // pus
    "Lohita",     // blood
    "Sedo",       // sweat
    "Medo",       // fat
    "Assu",       // tears
    "Vasā",       // fat/grease
    "Khelo",      // saliva
    "Siṅghāṇikā", // snot
    "Lasikā",     // synovial fluid
    "Mutta",      // urine
    "Matthaluṅga" // brain
];

export function generateName() {
    const adjective =
        adjectives[Math.floor(Math.random() * adjectives.length)];

    const name =
        names[Math.floor(Math.random() * names.length)];

    return `${adjective}${name}`;
}