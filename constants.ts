import { EraData, EraId } from './types';

export const SHARED_PROMPT_INSTRUCTIONS = `A hyper-realistic, high-resolution portrait-oriented photo. Each person’s appearance must accurately match the source photo, fully preserving identity, natural skin tone, ethnic features, gender, age, facial structure, and expression. The final image should look like a modern professional photoshoot with an authentic historical theme. Everything must appear natural, cohesive, and true to the original individuals. No cartoon style, no distortion.`;

export const IDENTITY_PRESERVATION_GUIDE = `REQUIREMENTS:
- KEEP the original faces and identity visible and recognizable. Do NOT alter features.
- Change ONLY clothing, hair, and accessories to be historically accurate.
- Photorealistic, high quality, 9:16 portrait.
- Lighting must be cinematic, volumetric, and natural, casting realistic shadows on the clothing layers.`;

export const ERAS: EraData[] = [
  {
    id: EraId.OLD_EGYPT,
    name: "Old Kingdom",
    description: "Journey back to the time of Pharaohs, majestic architecture, and sacred art (c. 2686–2181 BC).",
    previewImage: "./Old-Egypt-Preview.png",
    scenery: [
      {
        // 1. PHILAE TEMPLE QUAY
        prompt: "A wide-angle full-body environmental portrait on the stone quay of the Philae Temple. The subject stands centrally, allowing a view of the surroundings. To their side rests a magnificent gilded Royal Bark (ritual boat) on a sledge. The background features towering temple Pylons covered in distinct Egyptian reliefs and the wide blue Nile. Bright, expansive, and regal.",
        maleClothingIds: [
          "Pharaoh's Regalia: A bare chest adorned with a massive gold Wesekh collar (lapis/turquoise), heavy gold armbands, and a stiff pleated white Shendyt kilt with a gold central belt panel. Headwear: The striped Nemes headdress with Uraeus (cobra). Footwear: Intricate gold leather royal sandals.",
          "High Priest of Amun: A pristine white starched linen kilt. Worn with a ceremonial leopard-skin sash (gold-clawed) draped precisely over one shoulder. Gold wrist cuffs and a heavy gold pectoral necklace. Footwear: Fine leather sandals.",
          "Royal Fan Bearer: A bare torso with a stiff white linen kilt and a broad sash across the chest. He holds a tall ceremonial Ostrich Feather Fan (Flabellum) standard. Wears a gold collar. Footwear: Sturdy leather sandals."
        ],
        femaleClothingIds: [
          "Great Royal Wife: A tight-fitting, ankle-length white linen Kalasiris (sheath). Worn with the elaborate gold Vulture Headdress and a massive gold Usekh collar. Footwear: Gold sandals.",
          "Royal Princess: A sheath dress of the finest white linen, adorned with a wide collar of gold and turquoise faience and gold rings. Footwear: Beaded leather sandals.",
          "High Priestess: A tight-fitting pleated linen sheath dress with a heavy gold sash. She wears a solid gold circlet featuring a lotus motif and a heavy jeweled collar. Footwear: Fine leather sandals."
        ]
      },
      {
        // 2. GREAT SPHINX & OBELISKS
        prompt: "A majestic wide-angle full-body portrait with the Great Sphinx of Giza filling the background. The subject stands on a wide paved processional path lined with small alabaster sphinxes. The Sphinx texture is sharp limestone. In the foreground, tall gold-capped obelisks frame the shot. Harsh desert sunlight glints off heavy gold jewelry. Monumental scale.",
        maleClothingIds: [
          "Warrior Pharaoh: A ceremonial Golden Corselet (armor made of gold scales) worn over a tunic. Broad gold armbands, a patterned leather battle belt with gold lions, and the Blue War Crown (Khepresh). Footwear: High-strapped leather battle sandals.",
          "Royal Overseer of Works: A fine pleated linen cape covering the shoulders, worn over a starched triangular kilt. A heavy gold chain of office with a large scarab pendant. Wears a gold Uraeus circlet. Footwear: Sturdy leather sandals.",
          "Royal Treasurer: A distinct high-waisted linen garment reaching the ankles, with a stiff triangular front panel. Carrying a gold seal and a papyrus scroll. Heavy gold armlets. Footwear: Fine leather sandals."
        ],
        femaleClothingIds: [
          "Royal Matriarch: A stiff pleated linen gown in cream with distinct gold thread embroidery on the hem and sleeves. A broad gold Wesekh collar and a gold Modius (crown base) topped with tall plumes. Footwear: Gold sandals.",
          "Palace Noblewoman: A fitted sheath dress made of very fine pleated linen. Worn with a heavy gold headband featuring a central Uraeus cobra and heavy gold hoop earrings. Footwear: Fine leather sandals.",
          "Queen's Attendant: A tight-fitting white sheath dress with a vibrant gold-and-lapis patterned sash, a heavy gold pectoral necklace, and gold decorative tubes. Footwear: Embellished leather sandals."
        ]
      },
      {
        // 3. KARNAK HYPOSTYLE HALL
        prompt: "A cinematic wide-angle full-body portrait inside the Hypostyle Hall of Karnak Temple. The subject is small relative to the towering columns covered in painted hieroglyphs. They stand next to massive solid gold offering tables reflecting the light. In the background, electrum-plated (gold/silver mix) temple doors shine. The air is filled with incense smoke.",
        maleClothingIds: [
          "Ceremonial Pharaoh: A long, sheer pleated linen robe worn over a gold-patterned Shendyt kilt. Adorned with a massive gold collar, gold bracelets, and the Double Crown (Pschent). Footwear: Royal gold sandals.",
          "High Priest of Karnak: A starched white linen tunic with stiff pleated sleeves. A massive gold pectoral necklace featuring the winged Isis. Footwear: Fine leather sandals.",
          "Royal Architect: A bare torso with a white linen kilt, carrying a gold cubit rod (measuring tool) and a scroll. Wearing a simple gold amulet necklace. Footwear: Leather sandals."
        ],
        femaleClothingIds: [
          "God's Wife of Amun: A fitted linen sheath covered by a fine pleated overlay. Worn with a heavy gold collar featuring the Eye of Horus and a tall plumed gold headdress. Footwear: Gold sandals.",
          "Royal Daughter: A delicate form-fitting dress of fine linen with a sash of gold woven fabric. Worn with a gold side-lock ornament and heavy gold bracelets. Footwear: Jeweled sandals.",
          "Temple Songstress of Amun: A fitted sheath dress of fine white linen, worn with a heavy gold collar and a gold circlet with real lotus flowers inserted. Footwear: Fine sandals."
        ]
      },
      {
        // 4. ROYAL PALACE TERRACE
        prompt: "A wide-angle full-body portrait on the Grand Riverside Terrace of the Royal Palace. The subject stands centrally on the polished marble floor. To the side is a magnificent Golden Lion Throne and tall golden candelabras. In the background, painted Lotus Columns support the roof, and the Nile flows in the distance. The scene is open and airy.",
        maleClothingIds: [
          "Palace Pharaoh: A distinctive Golden Pleated Shoulder Cape worn over a bare chest, paired with a long fine linen kilt with a stiff gold front panel. A heavy gold Wesekh collar. Footwear: Gold sandals with upturned toes.",
          "Royal Courtier: A fine linen tunic with wide pleated sleeves, adorned with a wide beaded collar in lapis and gold. Wears a gold headband. Footwear: Fine leather sandals.",
          "Crown Prince: A bare torso with a white kilt featuring a thick gold-patterned border, a distinct gold side-lock ornament, and a broad collar. Footwear: Leather sandals."
        ],
        femaleClothingIds: [
          "Queen on the Terrace: A fitted linen sheath gown woven with shimmering gold thread. Adorned with a gold circlet and a ceremonial scent cone. Massive gold earrings. Footwear: Gold-leafed sandals.",
          "Royal Harpist: A fine pleated linen dress over a sheath, with a wide gold sash. Gold hoop earrings and gold hair tubes. Footwear: Beaded sandals.",
          "Palace Noblewoman: A high-necked fine linen dress with elegant gold embroidery on the bodice. She wears a heavy necklace of red carnelian and gold. Footwear: Fine leather sandals."
        ]
      },
      {
        // 5. LUXOR TEMPLE COURTYARD
        prompt: "A dramatic wide-angle full-body portrait at Luxor Temple. The subject stands in the center of the vast forecourt. Behind them loom the colossal golden-granite statues of the Pharaoh. Priests carry a golden processional bark in the distance. Iron braziers burn brightly, illuminating the carved hieroglyphs on the walls.",
        maleClothingIds: [
          "Processional Pharaoh: A gold-embroidered linen tunic covered by a massive royal gold collar. Heavy gold wrist gauntlets, a gold-patterned kilt, and the striped Nemes headdress. Footwear: Heavy royal sandals.",
          "High Priest in Procession: A simple full-length white linen robe draped across the body with a gold sash, and a gold pectoral necklace. Footwear: Reed sandals.",
          "Temple Standard Bearer: A bare torso with a stiff white linen kilt. Carrying a tall pole topped with a gold image of the Jackal (Wepwawet). Heavy gold armbands. Footwear: Sturdy leather sandals."
        ],
        femaleClothingIds: [
          "Queen in Procession: A fitted white sheath gown overlaid with a detailed sash of gold beads. A Vulture headdress and heavy gold arm cuffs. Footwear: Gold sandals.",
          "Noble Attendant of the Queen: A simple, elegant fitted white dress with a wide gold patterned belt, carrying a gold sistrum (ritual rattle). Footwear: Leather sandals.",
          "Temple Singer of Luxor: A tight-fitting linen sheath dress with a heavy gold Menat necklace (ritual counterpoise) and gold bracelets. Footwear: Beaded sandals."
        ]
      },
      {
        // 6. VALLEY OF THE KINGS TOMB
        prompt: "A wide-angle full-body portrait inside a newly opened Royal Tomb. The walls are covered in vibrant paintings and gold leaf. The subject stands amidst a hoard of treasures: golden shrines, dismantled gold chariots, and life-size gold guardian statues. The floor is covered in gold artifacts. The ultimate discovery scene.",
        maleClothingIds: [
          "Pharaoh in the Tomb: A semi-sheer pleated linen robe worn over a white kilt with a gold apron. Heavy gold collar, gold armbands, and the Blue Crown (Khepresh). Footwear: Gold sandals.",
          "Royal Tomb Architect: A durable white linen tunic with a stiffened front, a leather belt holding gold tools, and gold signet rings. Footwear: Leather sandals.",
          "High Priest of Anubis: A black linen robe (ceremonial for funerary rites) worn with a gold jackal mask pushed up on the forehead (face visible), and heavy gold amulets. Footwear: Black leather sandals."
        ],
        femaleClothingIds: [
          "Royal Mourner Queen: A fitted white linen sheath dress, a gold diadem with mourning ribbons, and a fine linen veil draped loosely (face visible). Footwear: Gold sandals.",
          "Princess in the Tomb: A pleated linen gown with a narrow gold belt, a gold headband with a lotus, and a massive gold pectoral necklace featuring winged goddesses. Footwear: Fine leather sandals.",
          "Noblewoman of the Necropolis: A form-fitting white dress worn with a fine pleated linen shawl with heavy gold trim draped over the shoulders. Footwear: Sturdy walking sandals."
        ]
      },
      {
        // 7. TEMPLE OF HATSHEPSUT TERRACE
        prompt: "A symmetrical wide-angle full-body portrait at the Temple of Hatshepsut. The subject stands centrally on the wide stone terrace. Flanking them are gold-and-lapis sphinx statues. The background features the rhythmic rows of square columns stretching far back against the limestone cliff. Majestic, pristine, and rich.",
        maleClothingIds: [
          "Regal Builder Pharaoh: A fine pleated linen tunic worn under a massive broad collar of gold and lapis lazuli. Double-pleated Shendyt kilt, and the white Hedjet crown with a gold Uraeus. Footwear: Royal sandals.",
          "Noble Overseer: A white linen robe draped toga-style over a tunic, a heavy gold scribe's pendant, and gold rings. Footwear: Leather sandals.",
          "Royal Scribe of the Temple: A knee-length starched linen tunic, a gold stylus tucked behind the ear, and heavy gold amulets. Footwear: Reed sandals."
        ],
        femaleClothingIds: [
          "The Great Queen (Hatshepsut Style): A fitted pleated Kalasiris with a gold sash, the Nemes headdress (masculine style) or Vulture Crown, and heavy gold jewelry including arm cuffs. Footwear: Gold sandals.",
          "Court Lady: A tight-fitting white linen sheath dress with a heavy beaded collar in gold and turquoise, a gold lotus-flower headpiece, and gold bracelets. Footwear: Leather sandals.",
          "High Priestess of Hathor: A leopard-skin sash worn over a fitted linen dress, a gold uraeus headband, and a gold sistrum held in hand. Footwear: Beaded sandals."
        ]
      },
      {
        // 8. ABU SIMBEL
        prompt: "A powerful low-angle wide shot at Abu Simbel. The subject is small compared to the massive stone legs of the Ramses II statue behind them. The statue base has details painted in gold and color. The red sandstone glows in the sun. The composition emphasizes the monumental scale of the temple facade.",
        maleClothingIds: [
          "Warrior Pharaoh: A Golden Corselet armor worn over a tunic. Gold armguards, a broad collar, a kilt with a gold-studded belt, and the Blue War Crown (Khepresh). Footwear: Battle sandals with gold greaves.",
          "Royal Vizier of the South: A distinct high-waisted white linen garment reaching the ankles, suspended by a neck strap. Heavy gold armlets and a gold belt. Footwear: Fine leather sandals.",
          "Royal Cup Bearer: A bare torso with a stiff white linen kilt. Carrying a golden vessel. Heavy gold collar and wrist cuffs. Footwear: Leather sandals."
        ],
        femaleClothingIds: [
          "Temple Queen (Nefertari Style): A fitted white dress with heavy gold borders, a tall gold-feathered headdress, and a heavy gold collar. Footwear: Gold sandals.",
          "Noble Traveler: A sturdy pleated linen dress with a wide gold protective sash, a sheer scarf draped loosely (face visible), and large gold hoop earrings. Footwear: Leather sandals.",
          "Princess of the Two Lands: A fitted white linen sheath dress adorned with a golden beaded net (diamond pattern) over the fabric. Worn with ivory and gold jewelry. Footwear: Beaded sandals."
        ]
      }
    ],
    stamps: [
      "./Stamps/Old-Egyptian/1.png",
      "./Stamps/Old-Egyptian/2.png",
      "./Stamps/Old-Egyptian/3.png"
    ],
    frames: [
      "./Frames/Old-Egyptian/1.png"
    ]
  },
  {
    id: EraId.COPTIC_EGYPT,
    name: "Coptic Egypt",
    description: "Step into the era of monastic life, intricate textiles, and native Egyptian art (c. 3rd–7th Century AD).",
    previewImage: "./Coptic-Preview.png",
    scenery: [
      {
        // 1. DEIR MAR GIRGIS (Church of St. George)
        prompt: "A wide-angle landscape photograph capturing the unique circular architecture of the Church of St. George (Mar Girgis). The subject stands on the pavement. The church is a massive Rotunda built directly on top of an ancient Roman fortress tower. The walls feature distinct bands of red brick and limestone. The background includes the domed roof and Coptic crosses. The atmosphere is ancient, geometric, and imposing.",
        maleClothingIds: [
          "Coptic Wool Tunic: A heavy, dark green wool tunic reaching the knees (Reference: 'Green Tunic'). It features distinct vertical woven bands in red and beige running down the front. Belted with a leather cord. Footwear: Woven sandals.",
          "Merchant's Tunic: A fine linen tunic in natural flax color. It has broad vertical stripes (Clavi) in purple wool running from shoulder to hem. He holds a leather purse. Footwear: Leather shoes.",
          "Monk's Habit: A rough, dark brown wool tunic tied with a rope belt. He wears a leather hood (qalansuwa) with cross stitching. Footwear: Woven palm-fiber sandals."
        ],
        femaleClothingIds: [
          "Square-Neck Tunic: A natural unbleached linen tunic reaching the ankles. It features a square-shaped embroidered neckline in dark red geometric patterns. Footwear: Reed sandals.",
          "Decorated Tunic: A vibrant saffron-yellow tunic. It features a heavy woven collar in black and red wool. She wears silver bracelets. Footwear: Dyed leather shoes.",
          "Simple Tunic: A sturdy linen tunic dyed in a faded terracotta color. It features woven roundels (circles) on the knees in green wool. Footwear: Sturdy sandals."
        ]
      },
      {
        // 2. THE HANGING CHURCH (Al-Muallaqa)
        prompt: "A wide-angle environmental photograph in the entrance courtyard of the Hanging Church. The subject stands at the foot of the grand limestone staircase. Behind them, the facade rises high, built over the Roman Gatehouse. The twin white bell towers are visible against the sky, framed by date palms. The walls feature carved Coptic inscriptions and geometric stone rosettes. Historic and sun-drenched.",
        maleClothingIds: [
          "Coptic Wool Tunic: A heavy, dark green wool tunic reaching the knees. It features distinct vertical woven bands in red and beige running down the front. Belted with a leather cord. Footwear: Woven sandals.",
          "Merchant's Tunic: A fine linen tunic in natural flax color. It has broad vertical stripes (Clavi) in purple wool running from shoulder to hem. Footwear: Leather shoes.",
          "Monk's Habit: A rough, dark brown wool tunic tied with a rope belt. He wears a leather hood. Footwear: Woven palm-fiber sandals."
        ],
        femaleClothingIds: [
          "Square-Neck Tunic: A natural unbleached linen tunic reaching the ankles. It features a square-shaped embroidered neckline in dark red geometric patterns. Footwear: Reed sandals.",
          "Decorated Tunic: A vibrant saffron-yellow tunic. It features a heavy woven collar in black and red wool. She wears silver bracelets. Footwear: Dyed leather shoes.",
          "Simple Tunic: A sturdy linen tunic dyed in a faded terracotta color. It features woven roundels (circles) on the knees in green wool. Footwear: Sturdy sandals."
        ]
      },
      {
        // 3. DEIR SAM3AN KHARAZ (St. Simon the Tanner)
        prompt: "A monumental wide-angle photograph at the Cave Church of St. Simon. The subject stands in the vast open-air amphitheater carved into the Mokattam mountain. The sheer rock cliff face creates a natural roof overhang. The stone walls behind are covered in large, hand-carved reliefs of Coptic saints and biblical scenes chiseled directly into the mountain. The scale is epic and rugged.",
        maleClothingIds: [
          "Coptic Wool Tunic: A heavy, dark green wool tunic reaching the knees. It features distinct vertical woven bands in red and beige running down the front. Belted with a leather cord. Footwear: Woven sandals.",
          "Merchant's Tunic: A fine linen tunic in natural flax color. It has broad vertical stripes (Clavi) in purple wool running from shoulder to hem. Footwear: Leather shoes.",
          "Monk's Habit: A rough, dark brown wool tunic tied with a rope belt. He wears a leather hood. Footwear: Woven palm-fiber sandals."
        ],
        femaleClothingIds: [
          "Square-Neck Tunic: A natural unbleached linen tunic reaching the ankles. It features a square-shaped embroidered neckline in dark red geometric patterns. Footwear: Reed sandals.",
          "Decorated Tunic: A vibrant saffron-yellow tunic. It features a heavy woven collar in black and red wool. She wears silver bracelets. Footwear: Dyed leather shoes.",
          "Simple Tunic: A sturdy linen tunic dyed in a faded terracotta color. It features woven roundels (circles) on the knees in green wool. Footwear: Sturdy sandals."
        ]
      },
      {
        // 4. THE COPTIC MUSEUM
        prompt: "A medium-shot portrait in a historic Coptic courtyard. The subject stands on stone pavers. The walls behind them are a masterpiece of Coptic art: elaborate wooden Mashrabiya screens, limestone arches, and niches containing faded frescoes of saints with golden halos. Stone columns with Corinthian capitals line the walkway. The atmosphere is artistic and preserved.",
        maleClothingIds: [
          "Coptic Wool Tunic: A heavy, dark green wool tunic reaching the knees. It features distinct vertical woven bands in red and beige running down the front. Belted with a leather cord. Footwear: Woven sandals.",
          "Merchant's Tunic: A fine linen tunic in natural flax color. It has broad vertical stripes (Clavi) in purple wool running from shoulder to hem. Footwear: Leather shoes.",
          "Monk's Habit: A rough, dark brown wool tunic tied with a rope belt. He wears a leather hood. Footwear: Woven palm-fiber sandals."
        ],
        femaleClothingIds: [
          "Square-Neck Tunic: A natural unbleached linen tunic reaching the ankles. It features a square-shaped embroidered neckline in dark red geometric patterns. Footwear: Reed sandals.",
          "Decorated Tunic: A vibrant saffron-yellow tunic. It features a heavy woven collar in black and red wool. She wears silver bracelets. Footwear: Dyed leather shoes.",
          "Simple Tunic: A sturdy linen tunic dyed in a faded terracotta color. It features woven roundels (circles) on the knees in green wool. Footwear: Sturdy sandals."
        ]
      },
      {
        // 5. ANCIENT MONASTERY COMPLEX (Like St. Paul/Anthony)
        prompt: "A wide-angle landscape photograph of a fortified desert monastery. The subject stands on the desert sand. Behind them, the monastery rises like a fortress: high mud-brick walls, clusters of beige domes, and a bell tower, all built against a dramatic desert cliff. The architecture is organic and ancient. Palm trees cluster near the entrance.",
        maleClothingIds: [
          "Coptic Wool Tunic: A heavy, dark green wool tunic reaching the knees. It features distinct vertical woven bands in red and beige running down the front. Belted with a leather cord. Footwear: Woven sandals.",
          "Merchant's Tunic: A fine linen tunic in natural flax color. It has broad vertical stripes (Clavi) in purple wool running from shoulder to hem. Footwear: Leather shoes.",
          "Monk's Habit: A rough, dark brown wool tunic tied with a rope belt. He wears a leather hood. Footwear: Woven palm-fiber sandals."
        ],
        femaleClothingIds: [
          "Square-Neck Tunic: A natural unbleached linen tunic reaching the ankles. It features a square-shaped embroidered neckline in dark red geometric patterns. Footwear: Reed sandals.",
          "Decorated Tunic: A vibrant saffron-yellow tunic. It features a heavy woven collar in black and red wool. She wears silver bracelets. Footwear: Dyed leather shoes.",
          "Simple Tunic: A sturdy linen tunic dyed in a faded terracotta color. It features woven roundels (circles) on the knees in green wool. Footwear: Sturdy sandals."
        ]
      },
      {
        // 6. SAINT CATHERINE’S MONASTERY
        prompt: "A dramatic wide-angle landscape photograph at Saint Catherine’s Monastery. The subject stands on the rugged rocky ground. The background is dominated by the immense, jagged red granite mountains of Sinai. The high, thick stone fortress walls of the monastery protect green cypress trees inside. The light is sharp, clear, and high-altitude.",
        maleClothingIds: [
          "Coptic Wool Tunic: A heavy, dark green wool tunic reaching the knees. It features distinct vertical woven bands in red and beige running down the front. Belted with a leather cord. Footwear: Woven sandals.",
          "Merchant's Tunic: A fine linen tunic in natural flax color. It has broad vertical stripes (Clavi) in purple wool running from shoulder to hem. Footwear: Leather shoes.",
          "Monk's Habit: A rough, dark brown wool tunic tied with a rope belt. He wears a leather hood. Footwear: Woven palm-fiber sandals."
        ],
        femaleClothingIds: [
          "Square-Neck Tunic: A natural unbleached linen tunic reaching the ankles. It features a square-shaped embroidered neckline in dark red geometric patterns. Footwear: Reed sandals.",
          "Decorated Tunic: A vibrant saffron-yellow tunic. It features a heavy woven collar in black and red wool. She wears silver bracelets. Footwear: Dyed leather shoes.",
          "Simple Tunic: A sturdy linen tunic dyed in a faded terracotta color. It features woven roundels (circles) on the knees in green wool. Footwear: Sturdy sandals."
        ]
      }
    ],
    stamps: [
      "./Stamps/Coptic/1.png",
      "./Stamps/Coptic/2.png",
      "./Stamps/Coptic/3.png"
    ],
    frames: [
      "./Frames/Coptic/1.png"
    ]
  },
  {
    id: EraId.ISLAMIC_EGYPT,
    name: "Islamic Golden Age",
    description: "Step into the vibrant culture of medieval Cairo (c. 7th–16th century AD).",
    previewImage: "./Islamic-Preview.png",
    scenery: [
      {
        prompt: "A medium-shot environmental portrait of the subject standing in the vast, sunlit open courtyard of the Mosque of Amr ibn al-As. The background is crisp and highly detailed, showing the endless rows of ancient stone columns and the clear blue Egyptian sky above. The scene is bright and airy, capturing the scale of the architecture while keeping the subject well-lit and central. Photorealistic, 8k resolution, no blur.",
        maleClothingIds: [
          "Egyptian Scribe: A knee-length unbleached linen Robe (Qamis) with a simple leather belt, worn with a soft white turban wrapped loosely around a skullcap. Footwear: Leather sandals.",
          "Early Scholar: A voluminous earth-toned wool outer-mantle styled with a 'Taylasan' (a large scarf draped over the shoulders). Footwear: Soft leather shoes.",
          "Merchant's outfit: A beige cotton robe with wide sleeves, a leather belt carrying a travel pouch, and a sandstone-colored fabric wrapped loosely around the head. Footwear: Sturdy sandals."
        ],
        femaleClothingIds: [
          "Early Cairo style: A voluminous, unbleached linen outer-wrap (Izar) draped loosely over a rust-colored under-gown, with a simple cream headscarf tied loosely (face visible). Footwear: Simple slippers.",
          "Natural Dye outfit: A loose indigo-blue outer-robe worn over a lighter blue under-dress, with a simple linen veil draped over the shoulders (face visible). Footwear: Leather sandals.",
          "Modest earth-tone attire: A sleeveless wool over-garment in clay-brown worn over a long-sleeved beige dress, with a large, textured shawl pinned at the shoulder. Footwear: Sandals."
        ]
      },
      {
        prompt: "A majestic portrait taken on the high stone battlements of the Citadel of Saladin. The subject stands with the golden limestone walls behind them. The background reveals a sharp, panoramic view of medieval Cairo's skyline, with distinct minarets and domes visible in the distance (not blurred). The lighting is warm golden-hour sun, emphasizing the texture of the stone and the subject's attire. Epic scale, sharp focus throughout.",
        maleClothingIds: [
          "Master Builder's attire: A practical knee-length wool robe in olive green with a leather belt holding rolled parchments, worn with loose trousers and a simple head-wrap. Footwear: Boots.",
          "Dignitary's attire: A long striped wool cloak (Aba) in brown and cream worn over a lighter robe, with a neatly wound white turban. Footwear: Leather shoes.",
          "Striped Cotton Robe: A blue and white striped kaftan worn open over a white under-robe, fastened with a wide white fabric sash (not silk) and a clean white turban. Footwear: Leather sandals."
        ],
        femaleClothingIds: [
          "Ayyubid Noblewoman: A heavy sapphire-blue wool coat (Jubba) worn open over a silver-grey silk under-gown, paired with a white wimple wrapped loosely (face visible) and a blue veil. Footwear: Embroidered shoes.",
          "Richly colored outfit: A deep maroon open-front coat worn over a mustard-yellow flowing dress, with a white linen coif covering the hair, and a maroon veil flowing down the back. Footwear: Fine leather slippers.",
          "Layered linen outfit: A loose, moss-green outer robe worn over a rust-colored under-gown, with a cream veil covering the hair and neck. Footwear: Simple shoes."
        ]
      },
      {
        prompt: "A portrait standing in the center of the colossal open-air courtyard of the Sultan Hassan Mosque. Behind the subject rises the towering stone arch of the main Iwan and the domed ablution fountain. The details of the muqarnas (stalactite carvings) and the sheer height of the walls are sharp and distinct. Bright natural sunlight floods the space, creating a grand, monumental atmosphere. Detailed architecture, clear blue sky.",
        maleClothingIds: [
          "Mamluk Notable: A heavy red velvet coat (Qaba) with gold-thread geometric embroidery, worn over a silk robe with a large, elaborate ceremonial turban. Footwear: Riding boots.",
          "Sunni Al-Azhar Scholar: A pristine white outer-robe (Farajiyya) with voluminous wide sleeves, worn over a pale grey under-robe. The turban is white, neatly wrapped, with a visible 'tail' hanging down the back. Footwear: White slippers.",
          "Court Official: A stiff brocade coat in turquoise and gold geometric patterns, with a high collar and a tall, structured hat wrapped in white cloth. Footwear: Leather boots."
        ],
        femaleClothingIds: [
          "Mamluk Aristocrat: An emerald green damask outer-coat with wide elbow-length sleeves revealing a fitted gold under-sleeve, worn with a jeweled headband and a sheer silk veil trailing behind. Footwear: Silk slippers.",
          "Heavy crimson velvet coat worn open to reveal a gold-embroidered under-gown, with a structured headdress supporting a long silk veil. Footwear: Gold-embroidered shoes.",
          "Festive attire: A heavy, open-front dark purple velvet coat (Qaba) with wide sleeves, worn OVER a silver-grey silk under-gown, featuring geometric gold embroidery, with a white wimple and separate sheer veil. Footwear: Fine leather shoes."
        ]
      },
      {
        prompt: "A wide-angle portrait in the vast open courtyard of the Ibn Tulun Mosque. The subject is framed against the iconic spiral minaret in the background, which is fully in focus. The repeating geometric arches of the surrounding arcade create a strong sense of perspective. The scene is bathed in bright afternoon light, highlighting the stucco carvings and the red brick texture. Serene, geometric, highly detailed background.",
        maleClothingIds: [
          "Wealthy Scribe: A long, flowing Deep Saffron (orange-yellow) linen robe with embroidered text bands (Tiraz) on the upper arms, worn with a simple round turban. Footwear: Leather shoes.",
          "Cairo Merchant: A loose, rich indigo-blue robe reaching the ankles with wide sleeves, belted at the waist with a patterned woven sash, and a soft white head-wrap. Footwear: Leather sandals.",
          "Layered robes in cream and pale blue linen, featuring a draped shoulder mantle and a neat turban, reflecting the style of a wealthy intellectual. Footwear: Soft leather slippers."
        ],
        femaleClothingIds: [
          "Fine silk gown in unbleached white with embroidered text bands (Tiraz) on the sleeves, worn with a woven sash and a fine sheer veil pinned to the hair. Footwear: Silk slippers.",
          "Soft pastel-layered robes: A dusty pink outer-robe worn over a sage green under-layer, loose fitting with wide sleeves, paired with a simple headband and light scarf. Footwear: Simple shoes.",
          "Patterned Over-Robe: A rich garment featuring woven geometric motifs (Islamic style), worn over a long flowing dress, with a draped shawl covering the hair. Footwear: Leather sandals."
        ]
      }
    ],
    stamps: [
      "./Stamps/Islamic/1.png",
      "./Stamps/Islamic/2.png",
      "./Stamps/Islamic/3.png",
      "./Stamps/Islamic/4.png"
    ],
    frames: [
      "./Frames/Islamic/1.png"
    ]
  },
  {
    id: EraId.MODERN_EGYPT,
    name: "Modern Egypt",
    description: "Experience the vibrant energy and leisure of contemporary Egypt.",
    previewImage: "./Modern-Preview.png",
    scenery: [
      {
        prompt: "a traditional Felucca boat sailing on the Nile River at golden hour, with the Cairo skyline and Cairo Tower visible in the distance. The water ripples gently, and the white sail catches the warm light.",
        maleClothingIds: ["stylish casual polo shirt and chinos, modern tourist summer wear."],
        femaleClothingIds: ["fashionable summer dress and sun hat, modern chic travel outfit."]
      },
      {
        prompt: "underwater in the Red Sea, surrounded by vibrant coral reefs and colorful tropical fish. The water is crystal clear and turquoise, with sunlight refracting through the surface.",
        maleClothingIds: ["modern rash guard and swim shorts, professional snorkeling gear."],
        femaleClothingIds: ["stylish wetsuit or rash guard, modern diving aesthetic."]
      },
      {
        prompt: "a colorful hot air balloon basket high above Luxor at sunrise, with a breathtaking view of the Valley of the Kings and lush green fields below.",
        maleClothingIds: ["modern outdoor jacket and casual trousers, sunrise travel gear."],
        femaleClothingIds: ["fashionable layered city-chic travel outfit with a light scarf."]
      }
    ],
    stamps: [
      "./Stamps/Modern-Egypt/1.png"
    ],
    frames: [
      "./Frames/Modern-Egypt/1.png",
      "./Frames/Modern-Egypt/2.png"
    ]
  },
  {
    id: EraId.SNAP_A_MEMORY,
    name: "Snap a Memory",
    description: "Capture a beautiful portrait with an Egyptian frame.",
    previewImage: "./Snap-A-Memory.png",
    scenery: [],
    stamps: [
      "./Stamps/Modern-Egypt/1.png"
    ],
    frames: [
      "./Frames/Modern-Egypt/1.png"
    ]
  }
];