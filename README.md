# CALM GYM: cómo instalarla en tu iPhone

*Constancia · Actitud · Lucha · Mente*

La app es una web app instalable (PWA). Solo hace falta publicarla **una vez** en una web estática y gratuita (GitHub Pages) para que Safari pueda instalarla. Después:

- se abre desde su icono a pantalla completa, como cualquier app;
- funciona **sin internet** (modo avión incluido);
- **tus datos no salen nunca del iPhone**: no hay servidor, cuenta ni base de datos en la nube. En GitHub solo está el código.

## 1. Publicarla (unos 5 minutos, desde el PC)

1. Crea una cuenta gratuita en https://github.com (si no la tienes).
2. Pulsa **New repository**. Ponle de nombre `calm-gym`, márcalo como **Public** y pulsa **Create repository**.
3. En la página del repositorio, pulsa **uploading an existing file** y arrastra **todos los archivos** de esta carpeta (index.html, app.js, data.js, sw.js, manifest.webmanifest y los tres icon-*.png). Pulsa **Commit changes**.
4. Ve a **Settings → Pages**. En *Source* elige **Deploy from a branch**, rama **main**, carpeta **/ (root)** y pulsa **Save**.
5. Espera 1 o 2 minutos. La dirección será `https://TU-USUARIO.github.io/calm-gym/`.

## 2. Instalarla en el iPhone

1. Abre esa dirección en **Safari** (con internet, solo esta vez).
2. Pulsa **Compartir** (el cuadrado con la flecha) → **Añadir a pantalla de inicio** → **Añadir**.
3. Abre la app **desde el icono** una vez con conexión, para que se guarde en el teléfono.
4. Comprueba que funciona: activa el modo avión, cierra la app y vuelve a abrirla.

## 3. Cuidar tus datos

- Los datos viven solo en el almacenamiento de la app en el iPhone. Si borras la app de la pantalla de inicio, **se borran con ella**.
- Haz copias de vez en cuando en **Ajustes → Exportar copia** y guárdalas en *Archivos* o en iCloud Drive. Para recuperarlas: **Ajustes → Importar copia**. La app te avisa si hace más de dos semanas que no haces una.
- Ábrela con cierta frecuencia: iOS puede limpiar los datos de las web apps que lleven muchas semanas sin usarse.

## 4. Actualizarla en el futuro

Sube los archivos nuevos al mismo repositorio y, en `sw.js`, cambia `gym-v1` por `gym-v2` (y así sucesivamente). Al abrir la app con internet se actualizará sola, sin perder datos.

## Limitaciones de iOS para web apps

- El aviso de fin de descanso (pitido y vibración) solo suena con la app en primer plano. El temporizador sigue contando aunque salgas, y al volver muestra el tiempo correcto.
- El pitido respeta el modo silencio y no corta tu música.
- La vibración funciona a partir de iOS 18.
