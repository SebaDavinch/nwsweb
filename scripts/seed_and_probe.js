(async()=>{
  try{
    const body = {
      user:{
        id:'20393',
        username:'NWS0001',
        name:'',
        email:'',
        rank:'Captain',
        hours:0,
        flights:0,
        joinedAt:'2025-07-31T08:26:49+00:00',
        avatar:''
      },
      accessToken:'dev-token'
    };
    const r1 = await fetch('http://localhost:8787/__dev/seed-vamsys-session',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
    const r = await r1.json();
    console.log('seed', JSON.stringify(r));
    const cookie = 'nws_vamsys_session=' + r.sessionId;
    const v1 = await fetch('http://localhost:8787/api/auth/vamsys/me',{headers:{'Cookie':cookie}});
    const vtext = await v1.text();
    console.log('/api/auth/vamsys/me', v1.status, vtext);
    const u1 = await fetch('http://localhost:8787/api/auth/me',{headers:{'Cookie':cookie}});
    const utext = await u1.text();
    console.log('/api/auth/me', u1.status, utext);
  }catch(e){
    console.error('error', e);
    process.exit(1);
  }
})();
