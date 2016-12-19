#coding=utf-8
import threading
from time import ctime,sleep
import numpy as np
from scipy.cluster.vq import *
from matplotlib import pyplot as plt
import copy
import math
import datetime
import random
import json
import time

####################################
rootobj=None;
Gtgtime=0;
GSNUM=-1;
GDNUM=-1;
GTNUM=-1;
GDJROOT=None;
GDJFilePath="vrp/static/inputjson.txt";
GLoopTime=500;
####################################
#global class to hold global vars
class glomat:
	def __init__(self,vfpath):
		global GDJROOT;
		global GSNUM;
		global GDNUM;
		global GTNUM;
		self.snum=GSNUM;
		self.tnum=GTNUM;
		self.dnum=GDNUM;
		
		self.tpathvec=[];
		for iter in range(self.tnum):
			self.tpathvec.append([]);
		
		self.spos=np.zeros([self.snum,2]);
		self.dpos=np.zeros([self.dnum,2]);
		self.tpos=np.zeros([self.tnum,2]);
		
		self.snumvec=[];
		self.dnumvec=[];
		self.tnumvec=[];
		for iter in range(self.tnum):
			self.tnumvec.append(0);
		
		for iter in range(self.snum):
			temx=GDJROOT['sourcelist'][iter]['x'];
			temy=GDJROOT['sourcelist'][iter]['y'];
			self.spos[iter]=np.array([temx,temy]);
			self.snumvec.append(GDJROOT['sourcelist'][iter]['num']);
		for iter in range(self.dnum):
			temx=GDJROOT['targetlist'][iter]['x'];
			temy=GDJROOT['targetlist'][iter]['y'];
			self.dpos[iter]=np.array([temx,temy]);
			self.dnumvec.append(GDJROOT['targetlist'][iter]['num']);
		for iter in range(self.tnum):
			temx=GDJROOT['trucklist'][iter]['x'];
			temy=GDJROOT['trucklist'][iter]['y'];
			self.tpos[iter]=np.array([temx,temy]);
		

		
		
		for titer in range(self.tnum):
			self.tpathvec[titer].append([[int(self.tpos[titer][0]),int(self.tpos[titer][1])],0]);
		
		#center quantities and center vecs
		if self.snum==10 and self.dnum==10 and self.tnum==5:
			self.scnum=5;
			self.dcnum=5;
			self.tcnum=5;
		elif self.snum==5 and self.dnum==5 and self.tnum==3:
			self.scnum=3;
			self.dcnum=3;
			self.tcnum=3;
		elif self.snum==8 and self.dnum==8 and self.tnum==4:
			self.scnum=4;
			self.dcnum=4;
			self.tcnum=4;
		elif self.snum==20 and self.dnum==20 and self.tnum==10:
			self.scnum=7;
			self.dcnum=5;
			self.tcnum=5;
		elif self.snum==25 and self.dnum==25 and self.tnum==15:
			self.scnum=7;
			self.dcnum=14;
			self.tcnum=10;
		elif self.snum==30 and self.dnum==30 and self.tnum==20:
			self.scnum=8;
			self.dcnum=8;
			self.tcnum=7;
		else :
			self.scnum=self.snum;
			self.tcnum=self.tnum;
			self.dcnum=self.dnum;
		self.scvec=[];
		self.tcvec=[];
		self.dcvec=[];
		#tstatevec
		self.tstatevec=[];
		for iter in range(self.tnum):
			self.tstatevec.append("OnHand");
		#leftnumvec;
		self.sleftvec=copy.deepcopy(self.snumvec);
		self.dleftvec=copy.deepcopy(self.dnumvec);
		#ECarVec
		self.ECarVec=[];
		for iter in range(self.tnum):
			self.ECarVec.append(iter);
		#truck dir vec
		self.tdirvec=[];
		for iter in range(self.tnum):
			self.tdirvec.append([0,0,[0,0],-1]);
		self.tvelocity=0.1;
		self.tcapacity=2; #!!!!

		for iter in range(self.scnum):
			self.scvec.append([]);
		for iter in range(self.tcnum):
			self.tcvec.append([]);
		for iter in range(self.dcnum):
			self.dcvec.append([]);
		
		##############################################
		self.solutionvec=[];
		for iter in range(self.dcnum):
			self.solutionvec.append(solution())
		##############################################
		self.SDMat=np.random.randint(2, size=(self.scnum,self.dcnum));
		self.TDMat=np.zeros([self.tcnum,self.dcnum]);
		for iter in range(self.tcnum):
			tline=np.zeros(self.dcnum);
			tnum=np.random.randint(0, 2)
			tnum=1;
			if tnum==1:
				tline[np.random.randint(0,self.dcnum)]=1;
			self.TDMat[iter]=tline;
		
def FindSIndexByPos(vgm,vpos):
	tsposvec=vgm.spos;
	for iter in range(len(tsposvec)):
		if AtPos(vpos[0],vpos[1],tsposvec[iter][0],tsposvec[iter][1]):
			return iter;
	return -1;

def FindTIndexByPos(vgm,vpos):
	ttposvec=vgm.tpos;
	for iter in range(len(ttposvec)):
		if AtPos(vpos[0],vpos[1],ttposvec[iter][0],ttposvec[iter][1]):
			return iter;
	return -1;

def FindDIndexByPos(vgm,vpos):
	tdposvec=vgm.dpos;
	for iter in range(len(tdposvec)):
		if AtPos(vpos[0],vpos[1],tdposvec[iter][0],tdposvec[iter][1]):
			return iter;
	return -1;

def AtPos(x1,y1,x2,y2):
	'''return whether nearly at same pos'''
	tdis=math.sqrt(math.pow(x1-x2,2)+math.pow(y1-y2,2));
	return abs(tdis)<1;
	
def Distance(p1,p2):
	x1=p1[0];
	y1=p1[1];
	x2=p2[0];
	y2=p2[1];
	return math.sqrt(math.pow(x1-x2,2)+math.pow(y1-y2,2));
class solution:
	def __init__(self):
		self.tcvec=[];
		self.scvec=[];
		self.svec=[];
		self.tvec=[];
		self.dvec=[];
		self.bUpdate=True;
	def stinit(self,vgm,vid):
		for tciter in self.tcvec:
			self.tvec+=vgm.tcvec[tciter];
		
		for titer in self.tvec:
			for iter in vgm.ECarVec:
				if iter==titer:
					vgm.ECarVec.remove(iter);
		
		
		for sciter in self.scvec:
			self.svec+=vgm.scvec[sciter];
			
		self.dvec=vgm.dcvec[vid];
		
		self.demandnum=0;
		for diter in self.dvec:
			self.demandnum+=vgm.dnumvec[diter];

		
	def IsCarEnough(self,vgm):
		return len(self.tvec)*vgm.tcapacity>=self.demandnum;
	def IsSEnough(self,vgm):
		for siter in self.svec:
			if vgm.sleftvec[siter]>0:
				return True;
		return False;
	def IsSatisfied(self,vgm):
		for diter in self.dvec:
			if vgm.dnumvec[diter]>0:
				return False;
		self.bUpdate=False;
		return True;
	def update(self,vgm,vdelta):
		if not self.bUpdate:
			return;
		if not self.IsCarEnough(vgm):
			#if cars too little ,and use ECarVec
			tnownum=len(self.tvec)*vgm.tcapacity;
			temx=(self.demandnum-tnownum)%vgm.tcapacity;
			tneednum=0;
			if temx==0:
				tneednum=int((self.demandnum-tnownum)/vgm.tcapacity);
			else :
				tneednum=int((self.demandnum-tnownum)/vgm.tcapacity)+1;
			if tneednum==0:
				print("???");
			if tneednum<=len(vgm.ECarVec):
				#enough,random choose car ???
				for iter in range(tneednum):
					temiter=random.randint(0,len(vgm.ECarVec)-1);
					temtindex=vgm.ECarVec[temiter];
					self.tvec.append(temtindex);
					vgm.tstatevec[temtindex]="OnHand";
					del vgm.ECarVec[temiter];
			else :
				#not enough ,put into all car 
				for titer in vgm.ECarVec:
					self.tvec.append(titer);
					vgm.tstatevec[titer]="OnHand";
				vgm.ECarVec=[];

		if not self.IsSEnough(vgm):
			if len(self.tvec)==0:
				return;
			temt=self.tvec[0];#???
			#find near new s
			atnears=-1;
			atemmindis=10000;
			for spiter in vgm.spos:
				temindex=FindSIndexByPos(vgm,spiter);
				if vgm.sleftvec[temindex]<=0 or (temindex in self.svec):
					continue;
				else:
					atemdis=Distance(vgm.tpos[temt],spiter); 
					if atemdis<atemmindis:
						atemmindis=atemdis;
						atnears=temindex;
			self.svec.append(atnears);
		
		for titer in self.tvec:
			tstate=vgm.tstatevec[titer];
			if tstate=="OnHand":
				if vgm.tnumvec[titer]>=vgm.tcapacity:
					vgm.tstatevec[titer]="ToLoad";
					continue;
				vgm.tstatevec[titer]="ToLoad";
				#find near s and load
				tnears=-1;
				temmindis=10000;
				for siter in self.svec:
					if vgm.sleftvec[siter]<=0:
						continue;
					else:
						temdis=Distance(vgm.tpos[titer],vgm.spos[siter]);
						if temdis<temmindis:
							temmindis=temdis;
							tnears=siter;
				if tnears==-1:
					#car too many ,go to ECarVec
					self.tvec.remove(titer);
					vgm.ECarVec.append(titer);
					vgm.tstatevec[titer]="Done";
					continue;
				#loadthe titer,tnears
				#update the car's location ,vdelta,record dir
				#once on,change state,change number
				#change left num
				tleft=vgm.tcapacity-vgm.tnumvec[titer];
				sleft=vgm.snumvec[tnears];
				tmin=min(tleft,sleft);
				vgm.sleftvec[tnears]-=tmin;

				k=0;b=0;
				deltax=0;deltay=0;
				x1=vgm.tpos[titer][0];
				y1=vgm.tpos[titer][1];
				x2=vgm.spos[tnears][0];
				y2=vgm.spos[tnears][1];
				if abs(x1-x2)<0.001:
					deltay=vgm.tvelocity;
					if y2<y1:
						deltay=-deltay;
					deltax=0;
				elif abs(y1-y2)<0.001:
					deltay=0;
					deltax=vgm.tvelocity
					if x2<x1:
						deltax=-deltax;
				else:
					k=(y2-y1)/(x2-x1);
					b=y1-k*x1;
					deltax= abs(vgm.tvelocity* math.cos(math.atan(-k)));
					if x2<x1:
						deltax=-deltax;
					deltay=abs(k*deltax);
					if y2<y1:
						deltay=-deltay;
				vgm.tdirvec[titer]=[deltax,deltay,[vgm.spos[tnears][0],vgm.spos[tnears][1]],tnears];
				vgm.tpos[titer][0]+=deltax;
				vgm.tpos[titer][1]+=deltay;
			elif tstate=="ToLoad":
				#change location by vdelta and tdirvec[titer]
				#once arrive,find d,change to "ToSend"
				if vgm.tnumvec[titer]>=vgm.tcapacity:
					pass;
				else:
					vgm.tpos[titer][0]+=vgm.tdirvec[titer][0];
					vgm.tpos[titer][1]+=vgm.tdirvec[titer][1];
				if AtPos(vgm.tpos[titer][0],vgm.tpos[titer][1],vgm.tdirvec[titer][2][0],vgm.tdirvec[titer][2][1]) or vgm.tnumvec[titer]>=vgm.tcapacity:
					#arrive s,find d and change dir and go
					if not vgm.tnumvec[titer]>=vgm.tcapacity:
						tarrives=vgm.tdirvec[titer][3];
						tleft=vgm.tcapacity-vgm.tnumvec[titer];
						sleft=vgm.snumvec[tarrives];
						tmin=min(tleft,sleft);
						vgm.tnumvec[titer]+=tmin;
						vgm.snumvec[tarrives]-=tmin;
						#print("car"+str(titer)+" load num:"+str(tmin)+" at s"+str(vgm.tdirvec[titer][3]));
						vgm.tpathvec[titer].append(["m"+str(vgm.tdirvec[titer][3]+1),tmin]);
					tneard=-1;
					temmindis=10000;
					for diter in self.dvec:
						if vgm.dleftvec[diter]<=0:
							continue;
						else:
							temdis=Distance(vgm.tpos[titer],vgm.dpos[diter]);
						if temdis<temmindis:
							temmindis=temdis;
							tneard=diter;
					#if no d to send ,consider it's done
					if(tneard==-1):
						vgm.tstatevec[titer]="Done";
						self.tvec.remove(titer);
						vgm.ECarVec.append(titer);
						continue;
						
					vgm.tstatevec[titer]="ToSend";
					tleft=vgm.tnumvec[titer];
					tdleft=vgm.dnumvec[tneard];
					tmin2=min(tleft,tdleft);
					vgm.dleftvec[tneard]-=tmin2;
					###change dir ,go to tneard;
					k=0;b=0;
					deltax=0;deltay=0;
					x1=vgm.tpos[titer][0];
					y1=vgm.tpos[titer][1];
					x2=vgm.dpos[tneard][0];
					y2=vgm.dpos[tneard][1];
					if abs(x1-x2)<0.001:
						deltax=0;
						deltay=vgm.tvelocity;
						if y2<y1:
							deltay=-deltay;
					elif abs(y1-y2)<0.001:
						deltay=0;
						deltax=vgm.tvelocity
						if x2<x1:
							deltax=-deltax;
					else:
						k=(y2-y1)/(x2-x1);
						b=y1-k*x1;
						deltax= abs(vgm.tvelocity* math.cos(math.atan(-k)));
						if x2<x1:
							deltax=-deltax;
						deltay=abs(k*deltax);
						if y2<y1:
							deltay=-deltay;
					vgm.tdirvec[titer]=[deltax,deltay,[vgm.dpos[tneard][0],vgm.dpos[tneard][1]],tneard];
					vgm.tpos[titer][0]+=deltax;
					vgm.tpos[titer][1]+=deltay;
			elif tstate=="ToSend":
			
				#once arrive,change to "Done"
				vgm.tpos[titer][0]+=vgm.tdirvec[titer][0];
				vgm.tpos[titer][1]+=vgm.tdirvec[titer][1];
				if AtPos(vgm.tpos[titer][0],vgm.tpos[titer][1],vgm.tdirvec[titer][2][0],vgm.tdirvec[titer][2][1]):
					vgm.tstatevec[titer]="Done";
					
					temd=vgm.tdirvec[titer][3];
					tleft=vgm.tnumvec[titer];
					dleft=vgm.dnumvec[temd];
					tmin=min(tleft,dleft);
					vgm.tnumvec[titer]-=tmin;
					vgm.dnumvec[temd]-=tmin;
					if tmin==0:
						print("***tleft"+str(tleft)+"***");
						#print("***dleft"+str(dleft)+"***");
						#print("***vgmdleft"+str(vgm.dleftvec[temd])+"***")
					#print("car"+str(titer)+" drop num:"+str(tmin)+" at d"+str(vgm.tdirvec[titer][3]));
					vgm.tpathvec[titer].append(["n"+str(vgm.tdirvec[titer][3]+1),tmin])
					#ensure put into ECarVec only once
					vgm.ECarVec.append(titer);
					self.tvec.remove(titer);
			elif tstate=="Done":
				pass;

def minit(vgm):
	
	for iter in range(vgm.dcnum):
		for coiter in range(vgm.tcnum):
			if vgm.TDMat[coiter][iter]==1:
				vgm.solutionvec[iter].tcvec.append(coiter)
	for iter in range(vgm.dcnum): 
		for coiter in range(vgm.scnum):
			if vgm.SDMat[coiter][iter]==1:
				vgm.solutionvec[iter].scvec.append(coiter)
		
	for iter in range(vgm.dcnum):
		vgm.solutionvec[iter].stinit(vgm,iter);
	return vgm;
			
def threadfunc(vgm,vid):
	tnowsolution=vgm.solutionvec[vid];
	#if cars too many,get rid of some???

	while not tnowsolution.IsSatisfied(vgm): 
		tnowsolution.update(vgm,0.1);

def mMainFunc(vgm):
	#if cars too many,get rid of some???
	tgtime=0;
	talls=False;
	while not talls:
		talls=True;
		tgtime+=1;
		for soiter in vgm.solutionvec:
			soiter.update(vgm,0.1);
			if not soiter.IsSatisfied(vgm):
				talls=False;
	global Gtgtime;
	Gtgtime=tgtime;

def allthread(vgm): 
	threads=[]
	for iter in range(len(vgm.solutionvec)):
		threads.append(threading.Thread(target=threadfunc,args=(vgm,iter)))
	for t in threads:
		t.setDaemon(True)
		t.start()
		

def theclust(vgm):
	############################################
	sfeature=np.vstack((vgm.spos));
	centroids,variance=kmeans(sfeature,vgm.scnum)
	code,distance=vq(sfeature,centroids)
	#plt.figure()
	for sciter in range(vgm.scnum):
		ndx=np.where(code==sciter)[0];
		for iter in range(len(sfeature[ndx,0])):
			tempos=[sfeature[ndx,0][iter],sfeature[ndx,1][iter]];
			vgm.scvec[sciter].append(FindSIndexByPos(vgm,tempos));
		#plt.scatter(sfeature[ndx,0],sfeature[ndx,1],c=np.random.random(size=3))
	##############################################

	############################################
	tfeature=np.vstack((vgm.tpos));
	centroids,variance=kmeans(tfeature,vgm.tcnum)
	code,distance=vq(tfeature,centroids)
	#plt.figure()
	for tciter in range(vgm.tcnum):
		ndx=np.where(code==tciter)[0];
		for iter in range(len(tfeature[ndx,0])):
			tempos=[tfeature[ndx,0][iter],tfeature[ndx,1][iter]];
			vgm.tcvec[tciter].append(FindTIndexByPos(vgm,tempos));
		#plt.scatter(sfeature[ndx,0],sfeature[ndx,1],c=np.random.random(size=3))
	##############################################

	############################################
	dfeature=np.vstack((vgm.dpos));
	centroids,variance=kmeans(dfeature,vgm.dcnum)
	code,distance=vq(dfeature,centroids)
	#plt.figure()
	for dciter in range(vgm.dcnum):
		ndx=np.where(code==dciter)[0];
		for iter in range(len(dfeature[ndx,0])):
			tempos=[dfeature[ndx,0][iter],dfeature[ndx,1][iter]];
			vgm.dcvec[dciter].append(FindDIndexByPos(vgm,tempos));
		#plt.scatter(sfeature[ndx,0],sfeature[ndx,1],c=np.random.random(size=3))
	##############################################

	#plt.axis('off')
	#plt.show()
	return vgm;
def EndPath(vgm):
	for titer in range(vgm.tnum):
		vgm.tpathvec[titer].append(["null",0])
	return vgm;
	
def PrintPath(vgm):
	for titer in range(vgm.tnum):
		print("truck"+str(titer+1)+":");
		for reiter in vgm.tpathvec[titer]:
			print(reiter[0]+" "+str(reiter[1]))
			
def IsNFlag(vstr):
	tstr=str(vstr);
	return tstr[0]=='n'; 
def OutRecordList(vgm):
	pathlist=[];
	for iter in range(vgm.tnum):
		tempath=[];
		for iter2 in range(len(vgm.tpathvec[iter])):
			if iter2==len(vgm.tpathvec[iter])-1:
				pass;
			else:
				tempath.append(vgm.tpathvec[iter][iter2][0]);
		temele={'truckid':iter+1,'path':tempath}
		pathlist.append(temele)
	
	recordlist=[];
	for titer in range(vgm.tnum):
		tnowload=0;
		for iter in range(len(vgm.tpathvec[titer])-1):
			tsource=vgm.tpathvec[titer][iter][0];
			ttarget=vgm.tpathvec[titer][iter+1][0];
			tnum=vgm.tpathvec[titer][iter][1];
			if IsNFlag(tsource):
				tnum=-tnum;
			tnowload+=tnum;
			temele={
			'truckid':titer+1,
			'source':tsource,
			'target':ttarget,
			'number':tnum,
			'nowload':tnowload
			};
			recordlist.append(temele);
	global rootobj;
	rootobj={'record':recordlist,'pathlist':pathlist,'time':0}
	
	
def mclustermain():
	gm=glomat(GDJFilePath);
	gm=theclust(gm);
	gm=minit(gm);
	mMainFunc(gm);#allthread(gm);
	gm=EndPath(gm);
	#PrintPath(gm);
	OutRecordList(gm);
	
	
t0=time.time();
temobj=None;
mintgtime=999999999999999;

temf= open(GDJFilePath);
temdatajsonstr="";
try:
	temdatajsonstr=temf.read()
finally:
	temf.close()
GDJROOT=json.loads(temdatajsonstr);
GSNUM=len(GDJROOT['sourcelist']);
GTNUM=len(GDJROOT['trucklist']);
GDNUM=len(GDJROOT['targetlist']);

if GSNUM==3 and GDNUM==3 and GTNUM==2:
	GLoopTime=100;
elif GSNUM==5 and GDNUM==5 and GTNUM==3:
	GLoopTime=200;
elif GSNUM==8 and GDNUM==8 and GTNUM==4:
	GLoopTime=300;
elif GSNUM==20 and GDNUM==20 and GTNUM==10:
	GLoopTime=1400;
elif GSNUM==25 and GDNUM==25 and GTNUM==15:
	GLoopTime=1000;
elif GSNUM==30 and GDNUM==30 and GTNUM==20:
	GLoopTime=1500;
for iter in range(0,GLoopTime):
	mclustermain();
	if Gtgtime<mintgtime:
		mintgtime=Gtgtime;
		temobj=copy.deepcopy(rootobj);
		#temobj=rootobj;
	rootobj=None;
t1=time.time();
temobj['time']=t1-t0;
outjsonstr=json.dumps(temobj);
print(temobj['time']);
temp = open('/var/www/mysite/vrp/static/temp.txt', 'r');
name = temp.read();
name = str(name);
f=open('/var/www/mysite/'+name,"w");
f.write(outjsonstr);
f.close();
