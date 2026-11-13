function probe(L,W,bandWidth,diameter,t){
 const rIn=diameter/2,yTop=rIn+.9,cornerAngle=Math.atan2(L/2,yTop),bandAngle=cornerAngle+.95,rB=rIn+1.2;
 const ex=-L/2,ey=yTop,bx=-rB*Math.sin(bandAngle),by=rB*Math.cos(bandAngle);
 const chord=Math.hypot(bx-ex,by-ey),m0=.5*chord,m1=.8*chord,t2=t*t,t3=t2*t;
 const h00=2*t3-3*t2+1,h10=t3-2*t2+t,h01=-2*t3+3*t2,h11=t3-t2;
 const x=h00*ex+h10*m0*(-1)+h01*bx+h11*m1*(-Math.cos(bandAngle));
 const y=h00*ey+h10*m0*0+h01*by+h11*m1*(-Math.sin(bandAngle));
 const alpha=Math.atan2(-x,y),innerY=rIn*Math.cos(alpha),yLow=rB*Math.cos(bandAngle);
 const u=Math.min(1,Math.max(0,(innerY-yLow)/(yTop-.15-yLow))),ease=.18;
 const flare=u<ease?(u*u)/(2*ease*(1-ease)):u>1-ease?1-(1-u)**2/(2*ease*(1-ease)):(u-ease/2)/(1-ease);
 const h=bandWidth/2+(W/2-bandWidth/2)*flare;
 return {L,W,bandWidth,diameter,t,cornerAngle,bandAngle,bx,by,chord,x,y,alpha,innerY,yLow,u,flare,h,z:-h+(2*h*6)/12};
}
for(let i=0;i<10000;i++){probe(12,5.5,2,17.2,.55);probe(13,7.5,2.2,15,.7);probe(12,11,2.2,17.2,.35)}
console.log(JSON.stringify([probe(12,5.5,2,17.2,.55),probe(13,7.5,2.2,15,.7),probe(12,11,2.2,17.2,.35),probe(12,11,2.2,17.2,.55)]));
