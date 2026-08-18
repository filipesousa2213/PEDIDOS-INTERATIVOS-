
const routes = {
  r1: [[-23.6585,-46.8855],[-23.6570,-46.8985],[-23.6555,-46.9095],[-23.6535,-46.9205],[-23.6505,-46.9290]],
  r2: [[-23.6585,-46.8855],[-23.6610,-46.8670],[-23.6650,-46.8475],[-23.6695,-46.8260],[-23.6745,-46.8055]],
  r3: [[-23.6585,-46.8855],[-23.6500,-46.8925],[-23.6430,-46.9005],[-23.6365,-46.9075],[-23.6305,-46.9140]],
  r4: [[-23.6585,-46.8855],[-23.6560,-46.8760],[-23.6530,-46.8675],[-23.6505,-46.8595],[-23.6480,-46.8520]],
  r5: [[-23.6585,-46.8855],[-23.6485,-46.8860],[-23.6385,-46.8870],[-23.6290,-46.8875],[-23.6200,-46.8885]]
};
const routeMeta = {
  r1:{type:'Residencial • Chácaras',dest:'Residência • Itatuba'},
  r2:{type:'Residencial • Urbana',dest:'Residência • Jardim Santo Eduardo'},
  r3:{type:'Residencial • Chácaras',dest:'Chácara • Ressaca'},
  r4:{type:'Saúde',dest:'Unidade de Saúde • Centro'},
  r5:{type:'Residencial • Chácaras',dest:'Residência • Capuava'}
};
const drones = [
  {id:'DRN-001',order:'UB-EMBU-001',dest:routeMeta.r1.dest,route:'r1',status:'EM ROTA',cls:'',speed:34,alt:112,battery:84,temp:4.2,eta:'12 min',progress:38,routePos:1.52},
  {id:'DRN-002',order:'UB-EMBU-002',dest:routeMeta.r2.dest,route:'r2',status:'EM ROTA',cls:'',speed:36,alt:128,battery:82,temp:4.3,eta:'15 min',progress:54,routePos:2.16},
  {id:'DRN-003',order:'UB-EMBU-003',dest:routeMeta.r3.dest,route:'r3',status:'EM ENTREGA',cls:'green',speed:28,alt:98,battery:68,temp:4.5,eta:'11 min',progress:76,routePos:3.04},
  {id:'DRN-004',order:'UB-EMBU-004',dest:routeMeta.r4.dest,route:'r4',status:'EM ROTA',cls:'',speed:30,alt:110,battery:74,temp:4.4,eta:'9 min',progress:43,routePos:1.72},
  {id:'DRN-005',order:'UB-EMBU-005',dest:routeMeta.r5.dest,route:'r5',status:'ATENÇÃO',cls:'yellow',speed:22,alt:95,battery:55,temp:7.6,eta:'10 min',progress:48,routePos:1.92}
];
const deliveries = drones.map(d=>({...d})).concat([
  {id:'DRN-007',order:'FC30-78947',dest:'UBS Santa Emília',status:'PREPARANDO',temp:4.2,eta:'13:15'},
  {id:'DRN-008',order:'FC30-78950',dest:'Centro Médico Embu',status:'ENTREGUE',temp:4.3,eta:'12:12'}
]);

const mapCenter=[-23.654,-46.875];
const cdPoint=[-23.6585,-46.8855];
let map, clientMap, markers={}, clientMarker=null, polylines={}, selected=drones[0], simTimer=null, clientTimer=null, incident=false;

function posOnRoute(route, t){
  const max=route.length-1, clamped=Math.max(0,Math.min(max,t));
  const i=Math.min(max-1,Math.floor(clamped)), f=clamped-i;
  return [route[i][0]+(route[i+1][0]-route[i][0])*f, route[i][1]+(route[i+1][1]-route[i][1])*f];
}
function remainingKm(d){
  const r=routes[d.route]; const max=r.length-1;
  return Math.max(0.2,(max-d.routePos)*1.15).toFixed(1).replace('.',',')+' km';
}
function droneIcon(cls=''){
  return L.divIcon({className:'',html:`<div class="drone-marker ${cls}">✈</div>`,iconSize:[32,32],iconAnchor:[16,16]});
}
function addBaseMap(el){
  const m=L.map(el,{zoomControl:true}).setView(mapCenter,13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(m);
  return m;
}
function initMap(){
  map=addBaseMap('map');
  L.circleMarker(cdPoint,{radius:9,color:'#67b1ff',fillColor:'#1469d9',fillOpacity:1}).addTo(map).bindTooltip('<b>CD UNIÃO BRASIL</b><br>Água Espraiada<br><small>Ponto demonstrativo</small>');
  Object.entries(routes).forEach(([k,r],idx)=>{
    polylines[k]=L.polyline(r,{color:idx===0?'#2782ff':'#2d65a8',weight:idx===0?4:2,opacity:idx===0?.95:.6,dashArray:idx===0?null:'7 7',className:'route-line'}).addTo(map);
    L.circleMarker(r[r.length-1],{radius:6,color:'#27d17f',fillColor:'#27d17f',fillOpacity:1}).addTo(map).bindTooltip(routeMeta[k].dest);
  });
  drones.forEach(d=>{
    const m=L.marker(posOnRoute(routes[d.route],d.routePos),{icon:droneIcon(d.cls)}).addTo(map)
      .bindTooltip(`<b>${d.id}</b><br>${d.status}<br>${d.alt} m | ${d.speed} km/h<br>🔋 ${d.battery}%`,{direction:'top'});
    m.on('click',()=>selectDrone(d)); markers[d.id]=m;
  });
}
function initClientMap(){
  clientMap=addBaseMap('client-map');
  const route=routes.r1;
  L.polyline(route,{color:'#2d7dff',weight:5,opacity:.95,className:'route-line'}).addTo(clientMap);
  L.circleMarker(route[0],{radius:7,color:'#3aa0ff',fillColor:'#3aa0ff',fillOpacity:1}).addTo(clientMap).bindTooltip('CD União Brasil • Água Espraiada');
  L.circleMarker(route[route.length-1],{radius:7,color:'#27d17f',fillColor:'#27d17f',fillOpacity:1}).addTo(clientMap).bindTooltip('Residência • Itatuba');
  clientMarker=L.marker(posOnRoute(route,drones[0].routePos),{icon:droneIcon('')}).addTo(clientMap).bindTooltip('DRN-001');
  clientMap.fitBounds(L.latLngBounds(route),{padding:[25,25]});
}
function selectDrone(d){
  selected=d;
  const mapIds={ 'sel-id':d.id,'sel-status':d.status,'sel-order':d.order,'sel-dest':d.dest,'sel-distance':remainingKm(d),'sel-eta':d.eta,'sel-speed':d.speed+' km/h','sel-alt':d.alt+' m','sel-battery':d.battery+'%','sel-temp':d.temp.toFixed(1).replace('.',',')+'°C'};
  Object.entries(mapIds).forEach(([id,val])=>{const el=document.getElementById(id);if(el)el.textContent=val});
}
function renderLists(){
  document.getElementById('latest-list').innerHTML=deliveries.slice(0,4).map(d=>`<div class="list-item"><div><b>${d.order}</b><small>${d.dest}</small></div><div><small>${d.status}</small><b>${d.eta}</b></div></div>`).join('');
  document.getElementById('deliveries-body').innerHTML=deliveries.map(d=>`<tr><td>${d.order}</td><td>${d.id}</td><td>${d.dest}</td><td><span class="status-pill">${d.status}</span></td><td>${typeof d.temp==='number'?d.temp.toFixed(1).replace('.',',')+'°C':'—'}</td><td>${d.eta}</td></tr>`).join('');
  document.getElementById('fleet-cards').innerHTML=drones.map(d=>`<article class="fleet-card"><strong>${d.id}</strong><span>DJI FlyCart 30</span><p>${d.status}</p><small>Bateria ${d.battery}% • ${d.alt} m • ${d.speed} km/h</small></article>`).join('');
  renderAlerts();
}
function renderAlerts(extra=''){
  const html=(extra?extra:'')+`
    <div class="alert warning"><b>CONDIÇÕES CLIMÁTICAS</b><span>Vento moderado em algumas regiões de Embu das Artes.</span></div>
    <div class="alert warning"><b>TEMPERATURA DA CARGA</b><span>DRN-005: temperatura próxima ao limite permitido.</span></div>
    <div class="alert info"><b>MANUTENÇÃO PROGRAMADA</b><span>DRN-006: manutenção preventiva agendada.</span></div>`;
  document.getElementById('alerts-list').innerHTML=html;
  document.getElementById('alerts-page').innerHTML=html;
}
function nav(){
  document.querySelectorAll('.nav-item').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));btn.classList.add('active');
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    const id=btn.dataset.view; document.getElementById(id).classList.add('active');
    const titles={dashboard:'Central de Operações',deliveries:'Entregas',tracking:'Rastreamento',fleet:'Frota',safety:'Segurança & Impacto',alerts:'Alertas'};
    document.getElementById('view-title').textContent=titles[id];
    if(id==='dashboard') setTimeout(()=>map.invalidateSize(),120);
  }));
}
function updateProgress(p){
  ['progress-text','client-progress-text'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=p+'%'});
  ['progress-bar','client-progress-bar'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.width=p+'%'});
}
function updateSharedUI(d){
  updateProgress(Math.round(d.progress));
  document.getElementById('client-temp').textContent=d.temp.toFixed(1).replace('.',',')+'°C';
  document.getElementById('client-distance').textContent=remainingKm(d);
  document.getElementById('client-eta').textContent=d.eta;
  document.getElementById('client-status').textContent=d.status;
  document.getElementById('tracking-temp').textContent=d.temp.toFixed(1).replace('.',',')+'°C';
  document.getElementById('tracking-battery').textContent=d.battery+'%';
  document.getElementById('tracking-eta').textContent=d.eta;
  document.getElementById('ops-track-status').textContent=d.status;
}
function tickDrone(d, speed=.055){
  if(d.status==='PAUSADO') return;
  const r=routes[d.route], max=r.length-1;
  d.routePos=Math.min(max,d.routePos+speed);
  d.progress=Math.min(100,(d.routePos/max)*100);
  d.speed=31+Math.round(Math.random()*7);
  d.alt=106+Math.round(Math.random()*12);
  d.battery=Math.max(43,d.battery-(Math.random()<.22?1:0));
  d.temp=4.05+Math.random()*.45;
  if(d.routePos>=max-.35 && d.routePos<max) d.status='PRÓXIMO AO DESTINO';
  if(d.routePos>=max){d.progress=100;d.speed=0;d.status=d.id==='DRN-001'?'AGUARDANDO RETIRADA':'ENTREGUE';}
  if(markers[d.id]) markers[d.id].setLatLng(posOnRoute(r,d.routePos)).setIcon(droneIcon(d.status==='ATENÇÃO'?'yellow':d.status==='EM ENTREGA'?'green':''));
}
function startOpsSimulation(){
  const btn=document.getElementById('start-sim');
  if(simTimer){clearInterval(simTimer);simTimer=null;btn.textContent='▶ CONTINUAR SIMULAÇÃO';return}
  btn.textContent='❚❚ PAUSAR SIMULAÇÃO';
  simTimer=setInterval(()=>{
    drones.slice(0,4).forEach((d,i)=>tickDrone(d,.045+(i*.008)));
    selectDrone(selected);updateSharedUI(drones[0]);
    if(clientMarker) clientMarker.setLatLng(posOnRoute(routes.r1,drones[0].routePos));
    if(drones[0].status==='AGUARDANDO RETIRADA'){clearInterval(simTimer);simTimer=null;btn.textContent='✓ DRONE NO DESTINO';arrivedForPickup()}
  },1000);
}
function startClientSimulation(){
  const btn=document.getElementById('client-start');
  if(clientTimer){clearInterval(clientTimer);clientTimer=null;btn.textContent='▶ CONTINUAR DEMONSTRAÇÃO';return}
  btn.textContent='❚❚ PAUSAR DEMONSTRAÇÃO';
  clientTimer=setInterval(()=>{
    tickDrone(drones[0],.065);
    if(clientMarker) clientMarker.setLatLng(posOnRoute(routes.r1,drones[0].routePos));
    updateSharedUI(drones[0]);selectDrone(drones[0]);
    if(drones[0].status==='AGUARDANDO RETIRADA'){clearInterval(clientTimer);clientTimer=null;btn.classList.add('hidden');arrivedForPickup()}
  },1000);
}
function arrivedForPickup(){
  const html=`<div class="done">✓ Pedido recebido <small>10:52</small></div><div class="done">✓ Medicamento separado <small>11:03</small></div><div class="done">✓ Carga preparada <small>11:14</small></div><div class="done">✓ Decolagem autorizada <small>11:20</small></div><div class="done">✓ Em trânsito <small>Concluído</small></div><div class="current">● Drone no destino <small>Agora</small></div><div>○ Validar QR e retirar</div>`;
  document.getElementById('client-timeline').innerHTML=html;document.getElementById('ops-timeline').innerHTML=html;
  document.getElementById('qr-sim').classList.remove('hidden');document.getElementById('lock-state').textContent='🔒 Aguardando QR do cliente';
}
function simulateQR(){
  const b=document.getElementById('qr-sim');b.disabled=true;b.textContent='Validando QR...';
  setTimeout(()=>{drones[0].status='COMPARTIMENTO DESTRAVADO';updateSharedUI(drones[0]);document.getElementById('lock-state').textContent='🔓 Compartimento destravado';b.classList.add('hidden');document.getElementById('pickup-confirm').classList.remove('hidden');document.getElementById('client-timeline').innerHTML=`<div class="done">✓ Pedido recebido</div><div class="done">✓ Medicamento separado</div><div class="done">✓ Drone no destino</div><div class="current">✓ QR validado • caixa destravada</div><div>○ Confirmar retirada</div>`;},1400);
}
function confirmPickup(){
  drones[0].status='RETORNANDO AO CD';updateSharedUI(drones[0]);document.getElementById('lock-state').textContent='🔒 Compartimento travado novamente';document.getElementById('pickup-confirm').classList.add('hidden');document.getElementById('client-timeline').innerHTML=`<div class="done">✓ Pedido recebido</div><div class="done">✓ Medicamento separado</div><div class="done">✓ Drone no destino</div><div class="done">✓ QR validado</div><div class="current">✓ Retirada concluída • drone retornando</div>`;document.getElementById('ops-timeline').innerHTML=document.getElementById('client-timeline').innerHTML;
}
function openHome(){document.getElementById('landing').classList.remove('hidden');document.getElementById('client-app').classList.add('hidden');document.getElementById('ops-app').classList.add('hidden')}
function openClient(){
  document.getElementById('landing').classList.add('hidden');document.getElementById('client-app').classList.remove('hidden');document.getElementById('ops-app').classList.add('hidden');
  if(!clientMap) setTimeout(initClientMap,80); else setTimeout(()=>clientMap.invalidateSize(),80);
  updateSharedUI(drones[0]);
}
function openOps(){
  document.getElementById('landing').classList.add('hidden');document.getElementById('client-app').classList.add('hidden');document.getElementById('ops-app').classList.remove('hidden');
  if(!map) setTimeout(initMap,80); else setTimeout(()=>map.invalidateSize(),80);
}
function showIncident(){
  incident=true; drones[0].status='PAUSADO'; selectDrone(drones[0]); updateSharedUI(drones[0]);
  if(markers['DRN-001']) markers['DRN-001'].setIcon(droneIcon('paused'));
  document.getElementById('incident-modal').classList.remove('hidden');
  renderAlerts(`<div class="alert critical"><b>CRÍTICO — DRN-001 PAUSADO</b><span>Condições climáticas adversas detectadas na rota principal.</span></div>`);
}
function resolveIncident(action){
  const d=drones[0];
  const messages={
    wait:'Operação mantida em espera. Nova avaliação em 3 minutos.',
    backup:'DRN-011 reserva acionado. Transferência de missão simulada.',
    ground:'Plano de contingência terrestre acionado. Motoboy Express em deslocamento.'
  };
  renderAlerts(`<div class="alert info"><b>CONTINGÊNCIA ATIVADA</b><span>${messages[action]}</span></div>`);
  if(action!=='wait'){d.status=action==='ground'?'ENTREGA TERRESTRE':'EM ROTA';if(markers[d.id])markers[d.id].setIcon(droneIcon(''))}
  document.getElementById('incident-modal').classList.add('hidden');selectDrone(d);updateSharedUI(d);
}
document.getElementById('open-client').addEventListener('click',openClient);
document.getElementById('open-ops').addEventListener('click',openOps);
document.getElementById('track-order').addEventListener('click',()=>{const code=document.getElementById('tracking-code').value.trim().toUpperCase();if(code==='UB-EMBU-001')openClient();else alert('Para a demonstração, utilize o código UB-EMBU-001.');});
document.querySelectorAll('[data-back-home]').forEach(b=>b.addEventListener('click',openHome));
document.getElementById('start-sim').addEventListener('click',startOpsSimulation);
document.getElementById('client-start').addEventListener('click',startClientSimulation);
document.getElementById('qr-sim').addEventListener('click',simulateQR);
document.getElementById('pickup-confirm').addEventListener('click',confirmPickup);
document.getElementById('reset-map').addEventListener('click',()=>map.setView(mapCenter,13));
document.getElementById('incident-btn').addEventListener('click',showIncident);
document.getElementById('close-modal').addEventListener('click',()=>document.getElementById('incident-modal').classList.add('hidden'));
document.querySelectorAll('[data-incident]').forEach(b=>b.addEventListener('click',()=>resolveIncident(b.dataset.incident)));
document.getElementById('search').addEventListener('input',e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('#deliveries-body tr').forEach(tr=>tr.style.display=tr.textContent.toLowerCase().includes(q)?'':'none')});
setInterval(()=>{const c=document.getElementById('clock');if(c)c.textContent=new Date().toLocaleTimeString('pt-BR')},1000);
window.addEventListener('load',()=>{renderLists();nav();selectDrone(selected);updateSharedUI(drones[0]);});

let orderMap,orderMarker,orderLine,newOrderData;
function openOrder(){landing.classList.add('hidden');client.classList.add('hidden');ops.classList.add('hidden');order.classList.remove('hidden');if(!orderMap)setTimeout(initOrderMap,80);else setTimeout(()=>orderMap.invalidateSize(),80)}
function initOrderMap(){orderMap=baseMap('orderMap');L.marker(BASE,{icon:cdIcon()}).addTo(orderMap).bindTooltip('<b>CD União Brasil</b><br>Origem da missão');orderMap.setView(BASE,12)}
function pseudoPoint(text){let h=7;for(const ch of text)h=(h*31+ch.charCodeAt(0))>>>0;let km=4+(h%4600)/100,a=(h%360)*Math.PI/180;return {km,pt:[BASE[0]+km/111*Math.cos(a),BASE[1]+km/(111*Math.cos(BASE[0]*Math.PI/180))*Math.sin(a)]}}
document.getElementById('orderBtn').onclick=openOrder;document.getElementById('orderBack').onclick=home;
document.getElementById('calculateOrder').onclick=()=>{let dest=destination.value.trim(),ct=city.value.trim();if(!dest){alert('Informe um destino.');return}let full=dest+(ct?', '+ct:''),p=pseudoPoint(full),seconds=Math.min(30,Math.max(10,Math.round(8+p.km*.35)));newOrderData={full,p,seconds};if(orderMarker)orderMap.removeLayer(orderMarker);if(orderLine)orderMap.removeLayer(orderLine);orderMarker=L.marker(p.pt,{icon:destIcon('📍')}).addTo(orderMap).bindTooltip('<b>Destino solicitado</b><br>'+full);orderLine=L.polyline([BASE,p.pt],{color:'#2d83ff',weight:5,dashArray:'8 7'}).addTo(orderMap);orderMap.fitBounds(L.latLngBounds([BASE,p.pt]),{padding:[35,35]});cDest.textContent=full;cMed.textContent=medicine.value+' • '+qty.value;cDist.textContent=p.km.toFixed(1).replace('.',',')+' km';cTime.textContent='~'+seconds+' segundos';orderStatus.textContent='Rota calculada ✓';demoSpeed.textContent=p.km>30?'Muito acelerada':p.km>15?'Acelerada':'Rápida';orderForm.classList.add('hidden');orderConfirm.classList.remove('hidden')}
document.getElementById('editOrder').onclick=()=>{orderConfirm.classList.add('hidden');orderForm.classList.remove('hidden')}
document.getElementById('confirmNewOrder').onclick=()=>{let id='UB-'+Math.floor(1000+Math.random()*9000);orderConfirm.classList.add('hidden');orderSuccess.classList.remove('hidden');newOrderId.textContent='Pedido '+id+' • '+medicine.value;orderStatus.textContent='Pedido confirmado • DRN-007';newOrderData.id=id}
document.getElementById('simulateNewOrder').onclick=()=>{alert('Pedido '+newOrderData.id+' pronto para a simulação. Nesta prévia, a missão é individual neste celular.');openClient()}
