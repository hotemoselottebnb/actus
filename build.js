const fs = require('fs');
const cheerio = require('cheerio');

const delay = ms => new Promise(res => setTimeout(res, ms));

async function build() {
  console.log("Début de la synchronisation des articles...");

  try {
    const sitemapRes = await fetch("https://www.flatshaker.fr/sitemap.xml");
    const sitemapXml = await sitemapRes.text();

    const urls = [...sitemapXml.matchAll(/<loc>(.*?)<\/loc>/g)]
      .map(m => m[1])
      .filter(url => url.includes("actus-88"))
      .reverse();

    let cardsHtml = "";
    if (!fs.existsSync('./articles')) fs.mkdirSync('./articles');

    for (const url of urls) {
      try {
        console.log(`Traitement de : ${url}`);
        const slug = url.split('/').filter(Boolean).pop();

        await delay(500);

        const res = await fetch(url);
        if (!res.ok) throw new Error(`Impossible de charger la page (Erreur ${res.status})`);
        
        const html = await res.text();
        const $ = cheerio.load(html);

        const title = $('meta[property="og:title"]').attr('content') || $('h1').text().trim() || slug.replace(/-/g, ' ');
        
        // Nettoyage agressif de l'image d'accueil pour la HD
        let image = $('meta[property="og:image"]').attr('content') || "";
        if (image) {
          image = image.split('?')[0]; // Enlève les codes parasites à la fin
          image = image.replace(/-\d+x\d+(?=\.[a-zA-Z0-9]+$)/, ''); // Enlève les dimensions de miniature
        }
        
        const excerpt = $('article p, main p, .blog-post p').first().text().substring(0, 180) + "...";

        // BOUTON "LIRE L'ARTICLE" SUR LES CARTES
        cardsHtml += `
          <article class="card">
            <div class="card-image" style="background-image:url('${image}'); background-size:cover; background-position:center"></div>
            <div class="card-content">
              <h3>${title}</h3>
              <p>${excerpt}</p>
              <a class="button" href="./articles/${slug}.html">Lire l’article</a>
            </div>
          </article>
        `;

        let contentNode = $('article, main, .blog-post').first();
        if (!contentNode.length) contentNode = $('body');

        contentNode.find('script, style, nav, header, footer, form, button, aside').remove();
        contentNode.find('a[href*="/blog/auteurs/"], a[href*="/blog/categories/"], a[href*="/blog/mots-cles/"]').each((i, el) => {
          const parent = $(el).closest('p, div, li, span');
          if (parent.length) parent.remove();
          else $(el).remove();
        });

        contentNode.find('figure, div, span, a').removeAttr('style');

        // Nettoyage agressif des images dans l'article pour la HD
        contentNode.find('img').each((i, el) => {
          let src = $(el).attr('data-src') || $(el).attr('data-lazy-src') || $(el).attr('src');
          if (src && !src.startsWith('data:')) {
            src = src.split('?')[0]; // Coupe tous les paramètres qui réduisent la taille
            src = src.replace(/-\d+x\d+(?=\.[a-zA-Z0-9]+)/, ''); // Coupe les dimensions miniatures
            src = src.trim();
            
            if (src.startsWith('//')) src = 'https:' + src;
            else if (!src.startsWith('http')) src = src.startsWith('/') ? `https://www.flatshaker.fr${src}` : `https://www.flatshaker.fr/${src}`;
            
            $(el).attr('src', src);
            $(el).css('display', '');
          } else if (src && src.startsWith('data:')) {
            $(el).css('display', 'none');
          }
          $(el).removeAttr('srcset sizes loading width height data-src data-lazy-src data-srcset data-orig-file style');
        });

        contentNode.find('a').each((i, el) => {
          let href = $(el).attr('href');
          if (href && !href.startsWith('#') && !href.startsWith('http')) {
            $(el).attr('href', href.startsWith('/') ? `https://www.flatshaker.fr${href}` : `https://www.flatshaker.fr/${href}`);
          }
          $(el).attr('target', '_blank').attr('rel', 'noopener noreferrer');
        });

        contentNode.find('h2, h3').each((i, el) => {
          if (!$(el).find('a').length) {
            let next = $(el).next();
            let found = null;
            while (next.length && !next.is('h2, h3')) {
              const imgLink = next.find('a img').parent('a').attr('href');
              if (imgLink) { found = imgLink; break; }
              next = next.next();
            }
            if (found) {
              const text = $(el).text().trim();
              $(el).html(`<a href="${found}" target="_blank">${text}</a>`);
            }
          }
        });

        const articleHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} – Actus 88</title>
  <meta name="robots" content="index,follow">
  <style>
    body{margin:0;font-family:Arial,sans-serif;background:#f4f1ea;color:#2b2b2b;}
    .topbar{background:#8b1e2d;padding:14px 20px;color:white;}
    .topbar-inner{max-width:900px;margin:auto;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;}
    .topbar-back{color:white;text-decoration:none;font-weight:bold;}
    .cta-location{background:white;color:#8b1e2d !important;padding:10px 16px;border-radius:10px;font-weight:bold;text-decoration:none;}
    .cta-location:hover{background:#f5e6e9;}
    .container{max-width:900px;margin:auto;padding:28px 20px 60px;}
    h1{font-size:2rem;margin-bottom:20px;}
    .hero-image{width:100%;max-height:460px;object-fit:cover;border-radius:18px;margin-bottom:24px;box-shadow:0 6px 20px rgba(0,0,0,0.08);}
    .content{background:white;border-radius:18px;padding:28px;box-shadow:0 6px 20px rgba(0,0,0,0.08);line-height:1.8;font-size:1.05rem;}
    .content h2, .content h3{margin-top:30px;color:#8b1e2d;}
    .content h2 a, .content h3 a{color:#8b1e2d;text-decoration:none;}
    .content h2 a:hover, .content h3 a:hover{text-decoration:underline;}
    .content img{width:100%; max-width:100%; height:auto; border-radius:14px; margin:24px auto; display:block; box-shadow:0 6px 20px rgba(0,0,0,0.08);}
    .back{display:inline-block;margin-bottom:18px;text-decoration:none;color:#8b1e2d;font-weight:bold;}
    .back-bottom{margin-top:28px;}
  </style>
</head>
<body>
  <div class="topbar">
    <div class="topbar-inner">
      <a href="../" class="topbar-back">← Retour aux Actus 88</a>
      <a href="https://www.flatshaker.fr/hotemoselottebnb" target="_blank" rel="noopener noreferrer" class="cta-location">Réservez un séjour</a>
    </div>
  </div>
  <main class="container">
    <a class="back" href="../">← Revenir à la liste des articles</a>
    <h1>${title}</h1>
    ${image ? `<img class="hero-image" src="${image}">` : ""}
    <div class="content">
      ${contentNode.html()}
    </div>
    <a class="back back-bottom" href="../">← Revenir à la liste des articles</a>
  </main>
</body>
</html>`;

        fs.writeFileSync(`./articles/${slug}.html`, articleHtml);
      } catch (err) {
        console.log(`Erreur ignorée sur l'article ${url} : ${err.message}`);
      }
    }

    let template = fs.readFileSync('template.html', 'utf8');
    template = template.replace('', cardsHtml);
    fs.writeFileSync('index.html', template);

    console.log("Génération terminée avec succès !");
  } catch (globalErr) {
    console.error("Le script a rencontré un problème majeur :", globalErr);
  }
}

build();
