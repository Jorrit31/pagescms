/* Contactformulier: versturen zonder dat de pagina herlaadt. Werkt ook zonder JavaScript (dan herlaadt de pagina). */
(function(){
  var geladen=Date.now();
  document.querySelectorAll('form[data-verstuur]').forEach(function(form){
    var fout=form.querySelector('.formulier-fout'),bedankt=form.querySelector('.formulier-bedankt'),knop=form.querySelector('[type=submit]');
    var gelukt=function(){form.reset();if(fout)fout.hidden=true;if(bedankt){bedankt.hidden=false;bedankt.scrollIntoView({block:'nearest'})}};
    var mislukt=function(tekst){if(fout){fout.textContent=tekst||'Versturen is niet gelukt. Probeer het later nog eens, of bel of mail ons.';fout.hidden=false}};
    form.addEventListener('submit',function(e){
      e.preventDefault();
      if(!form.reportValidity())return;
      var adres=form.getAttribute('action');
      if(adres.charAt(0)==='#'){gelukt();return} /* live voorbeeld in het beheerscherm: niets versturen */
      var data={};
      Array.prototype.forEach.call(form.elements,function(el){if(el.name&&!el.disabled&&el.type!=='submit')data[el.name]=el.value});
      data._t=geladen;data._pagina=location.href;
      knop.disabled=true;
      fetch(adres,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(data)})
        .then(function(r){return r.json().catch(function(){return{}}).then(function(j){if(!r.ok||!j.ok)throw new Error(j.error||'');gelukt()})})
        .catch(function(err){mislukt(err&&err.message)})
        .then(function(){knop.disabled=false});
    });
  });
  if(/[?&]verzonden=1/.test(location.search)){var b=document.querySelector('.formulier-bedankt');if(b)b.hidden=false}
})();

/* Bezoekersteller: één klein seintje per pagina naar het beheerscherm. Geen cookies, niets opgeslagen in de browser. */
(function(){
  var adres=document.documentElement.getAttribute('data-teller');
  if(!adres||window.top!==window.self||!navigator.sendBeacon)return;
  try{navigator.sendBeacon(adres,JSON.stringify({p:location.pathname,r:document.referrer}))}catch(e){}
})();

/* Kaart en agenda: laden pas na een tik. Zo zetten Google en de agenda geen cookies zonder dat de bezoeker dat wil. */
(function(){
  document.querySelectorAll('[data-laad]').forEach(function(vak){
    var knop=vak.querySelector('button');
    if(!knop)return;
    knop.addEventListener('click',function(){
      var f=document.createElement('iframe');
      f.src=vak.getAttribute('data-laad');
      f.title=vak.getAttribute('data-titel')||'';
      f.loading='lazy';
      f.setAttribute('allow','fullscreen');
      f.referrerPolicy='no-referrer-when-downgrade';
      vak.innerHTML='';
      vak.classList.add('geladen');
      vak.appendChild(f);
    });
  });
})();

/* "Nu open" bij de openingstijden, in Nederlandse tijd. Tijden als 08:00 – 17:30 of 08:00 – 12:00, 13:00 – 17:00. */
(function(){
  var DAGEN={zondag:0,sonntag:0,sunday:0,maandag:1,montag:1,monday:1,dinsdag:2,dienstag:2,tuesday:2,woensdag:3,mittwoch:3,wednesday:3,donderdag:4,donnerstag:4,thursday:4,vrijdag:5,freitag:5,friday:5,zaterdag:6,samstag:6,saturday:6};
  var KORT={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
  document.querySelectorAll('[data-open]').forEach(function(el){
    var lijst;try{lijst=JSON.parse(el.getAttribute('data-open'))}catch(e){return}
    var d={};
    try{new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Amsterdam',hourCycle:'h23',weekday:'short',hour:'2-digit',minute:'2-digit'}).formatToParts(new Date()).forEach(function(p){d[p.type]=p.value})}catch(e){return}
    var vandaag=KORT[d.weekday],nu=Number(d.hour)*60+Number(d.minute);
    var regel=null;
    lijst.forEach(function(x){if(DAGEN[String(x[0]||'').trim().toLowerCase()]===vandaag)regel=x});
    if(!regel)return;
    var blokken=[],re=/(\d{1,2})[:.](\d{2})\s*[-–]\s*(\d{1,2})[:.](\d{2})/g,m;
    while((m=re.exec(String(regel[1]||''))))blokken.push([m[1]*60+ +m[2],m[3]*60+ +m[4],m[3].padStart(2,'0')+':'+m[4],m[1].padStart(2,'0')+':'+m[2]]);
    var open=blokken.filter(function(b){return nu>=b[0]&&nu<b[1]})[0];
    var straks=blokken.filter(function(b){return nu<b[0]})[0];
    if(open){el.textContent='Nu open, tot '+open[2];el.className='nu-open is-open'}
    else if(straks){el.textContent='Nu gesloten, vandaag open vanaf '+straks[3];el.className='nu-open is-dicht'}
    else{el.textContent='Nu gesloten';el.className='nu-open is-dicht'}
    el.hidden=false;
  });
})();

/* Zoeken op de site: zoekt in zoeken.json (die maakt build.js). */
(function(){
  var schoon=function(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')};
  document.querySelectorAll('form[data-zoeken]').forEach(function(form){
    var invoer=form.querySelector('input'),uitslag=form.querySelector('.zoek-uitslag'),index=null,klok=null;
    var laad=function(){
      if(index)return Promise.resolve(index);
      return fetch(form.getAttribute('data-zoeken')).then(function(r){if(!r.ok)throw new Error();return r.json()}).then(function(j){index=j;return j});
    };
    var melding=function(tekst){uitslag.innerHTML='';var li=document.createElement('li');li.className='zoek-leeg';li.textContent=tekst;uitslag.appendChild(li)};
    var zoek=function(){
      var vraag=schoon(invoer.value).trim(),woorden=vraag.split(/\s+/).filter(Boolean);
      if(!woorden.length){uitslag.innerHTML='';return}
      laad().then(function(lijst){
        var hits=[];
        lijst.forEach(function(p){
          var t=schoon(p.titel),x=schoon(p.tekst),score=0;
          for(var i=0;i<woorden.length;i++){
            var w=woorden[i],inT=t.indexOf(w)>-1,n=x.split(w).length-1;
            if(!inT&&!n)return;
            score+=(inT?10:0)+Math.min(n,5);
          }
          var plek=x.indexOf(woorden[0]),begin=Math.max(0,plek-60);
          var stuk=(begin?'…':'')+String(p.tekst).slice(begin,begin+180).trim()+'…';
          hits.push({p:p,score:score,stuk:plek>-1?stuk:String(p.tekst).slice(0,160)+'…'});
        });
        hits.sort(function(a,b){return b.score-a.score});
        uitslag.innerHTML='';
        if(!hits.length){melding('Niets gevonden. Probeer een ander woord.');return}
        hits.slice(0,10).forEach(function(h){
          var li=document.createElement('li'),a=document.createElement('a'),p=document.createElement('p');
          a.href=h.p.url||'./';a.textContent=h.p.titel||'Homepage';p.textContent=h.stuk;
          li.appendChild(a);li.appendChild(p);uitslag.appendChild(li);
        });
      }).catch(function(){melding('Zoeken werkt op de echte website, niet in dit voorbeeld.')});
    };
    form.addEventListener('submit',function(e){e.preventDefault();zoek()});
    invoer.addEventListener('input',function(){clearTimeout(klok);klok=setTimeout(zoek,200)});
    var q=/[?&]q=([^&]*)/.exec(location.search);
    if(q){try{invoer.value=decodeURIComponent(q[1].replace(/\+/g,' '))}catch(e){}zoek()}
  });
})();
