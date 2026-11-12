# Datos de AnimeGuess

Todo vive en `data/<franquicia>/`. Los modos comparten los catálogos de su franquicia. Las reglas que eligen qué datos usa cada juego están en `src/franchises/<franquicia>/config.ts`.

| Qué querés buscar | Dónde está |
| --- | --- |
| Frases de Dragon Ball | [dragon-ball/source/frase.json](dragon-ball/source/frase.json) |
| Eventos de Dragon Ball | [dragon-ball/source/events.json](dragon-ball/source/events.json) |
| Personajes de Dragon Ball | [dragon-ball/source/characters.json](dragon-ball/source/characters.json) para editar y [dragon-ball/entities.json](dragon-ball/entities.json) para ver los datos enriquecidos con la API |
| Frases de Naruto | [naruto/source/frase.json](naruto/source/frase.json) |
| Categorías de Casillas de Naruto | [naruto/source/casillas.json](naruto/source/casillas.json) |
| Disponibilidad e intentos de cada modo | [mode.json](mode.json) |

## Fuentes editables y datos generados

- `source/` guarda los archivos curados a mano y los originales de imágenes. Las frases, los eventos de Línea de tiempo y las categorías de Casillas se leen desde su fuente editable. Podés cambiar el texto de una frase, conservando su ID, y verlo al recargar en desarrollo. Para publicarlo hace falta un build nuevo.
- En la raíz de la franquicia, `entities.json`, `content.json` y los catálogos especializados guardan datos preparados por los generadores. Se conservan para poder jugar y hacer builds sin volver a consultar las APIs. Por ejemplo, el catálogo de personajes combina los datos manuales con atributos de la API y las rutas de las imágenes procesadas. Editá la fuente correspondiente y ejecutá `npm run data:<franquicia>` para actualizar esos resultados.
- Las referencias `image` apuntan a `public/img/`. Por ejemplo, `dragon-ball/goku` se sirve como `public/img/dragon-ball/goku-256.webp` o `public/img/dragon-ball/goku-512.webp`.

Frase de Dragon Ball usa todo su catálogo, incluidas las entradas con `verified: false`. Las frases de Naruto y los eventos siguen requiriendo verificación para entrar en las partidas.
