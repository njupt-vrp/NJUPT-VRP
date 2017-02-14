#coding=gbk

#FileName: ACO.py 

import random 
import json 
import time 
import copy
import os 
import codecs 
from telnetlib import theNULL


c_skipgroup=0
c_updata=0
c_choosecity=0
c_chooseerror=0
c_nofinish=0
c_creatgrouperr=0
c_creatgroupnum=0

INPUTJSON="vrp/static/inputjson.txt"

ALPHA=2.0 #启发因子，信息素的重要程度
BETA=1.0 #期望因子，城市间距离的重要程度
ROU=0.5 #信息素残留参数

n_ant=3         #蚂蚁数量
n_iterator=10  #蚂蚁迭代次数
n_iter_group=100 #重复分组次数
n_iter_randNo=10 #子任务序列随机次数
n_city=50       #城市数量

MaxPhrm=1000.0 #总的信息素
InitPhrm=100.0 # 初始信息素
DB_MAX=10e9

DistrSize=0
citynum=0
n_source=0
n_target=0

city=[]
Distr=[]

class City:
    x=0
    y=0            # x，y为城市坐标
    num=0          #城市物资量，正为供应地，负为需求地
    name="init_name" #城市名字
    group=0          #分组情况
    def Out(self):   #城市信息输出
        print(self.name,"(",self.x,",",self.y ,")",self.num )
    def copy(self):
        temp=City()
        temp.x=self.x 
        temp.y=self.y 
        temp.num=self.num 
        temp.name=self.name 
        temp.group=self.group
        return temp
        
class Path:
    truckid=0             #车号
    source="init_source"  #出发地
    target="init_target"  #目的地
    number=0              #目的地num改变量
    nowload=0             #车到达目的地后的载货量
    #JSON输出利用JSON模块
    def __str__(self):
        s1=str(" \"truckid\":"+str(self.truckid)+",")
        s2=str(" \"source\":"+str(self.source)+",")
        s3=str(" \"target\":"+str(self.target)+",")
        s4=str(" \"number\":"+str(self.number)+",")
        s5=str(" \"nowload\":"+str(self.nowload)+"")
        s=str("{"+s1+s2+s3+s4+s5+"}")
        return s
    
class Truck:
    x=0
    y=0
    maxcapacity=0
    capacity=0
    truckid=0
    n_pathnum=0
    pathlen=0.0
    def __init__(self):
        self.truckpath=[]  #int truckpath[50];
        self.path=[]      #vector<Path> path;
        
        
        
    def Init(self):
        self.truckpath.clear()
        self.n_pathnum=0
        self.path.clear()
        self.pathlen=0.0
    def Out(self):
        print("truckid=",self.truckid,"(",self.x ,",",self.y ,")",
              self.maxcapacity,self.capacity)
    def copy(self):
        temp=Truck()
        temp.x=self.x 
        temp.y=self.y 
        temp.maxcapacity=self.maxcapacity
        temp.capacity=self.capacity
        temp.truckid=self.truckid
        temp.truckpath=copy.deepcopy(self.truckpath)
        temp.n_pathnum=self.n_pathnum
        temp.pathlen=self.pathlen
        temp.path=copy.deepcopy(self.path)
        return temp 
        
class CAnt:
    x=0
    y=0
    x_start=0
    y_start=0
    capacity=0
    maxcapacity=0
    truckid=0
    
    m_dbPathLength=0.0
    m_nCurCityNo=-1
    m_nMovedCityCount=0
    def __init__(self):
        self.m_nPath=[]
        self.path=[]
    def Init(self,truck ):
        #print("CAnt Init start ...")
        self.x=truck.x
        self.y=truck.y
        self.x_start=self.x 
        self.y_start=self.y 
        self.capacity=0
        self.truckid=truck.truckid 
        self.maxcapacity=truck.maxcapacity
        self.m_nPath.clear()
        self.m_nPath.append(-1)
        self.m_dbPathLength=0.0
        self.m_nCurCityNo=-1
        self.m_nMovedCityCount=1
        self.path.clear()
        #print("CAnt Init end...")
    def ChooseNextCity(self,citytemp,flag,Phrm,Distance):
        #print("ChooseNextCity start ...")
        #print("flag=",flag ) 
        global c_choosecity
        c_choosecity+=1
        nSelectedCity=-1
        n_citytemp=len(citytemp )
        
        dbTotal=0.0
        prob=[0.0 for i in range(n_citytemp)]
        for i in range(n_citytemp):
            if i==self.m_nCurCityNo:
                prob[i]=0.0
                continue 
            if flag==1:
                
                if citytemp[i].num>0:
                    prob[i]=(Phrm[self.m_nCurCityNo][i]**ALPHA) *( (1.0/Distance[self.m_nCurCityNo][i]) **BETA )
                    dbTotal+=prob[i]
                else:
                    prob[i]=0.0
            
            if flag==-1:
                if(citytemp[i].num<0):
                    prob[i]=(Phrm[self.m_nCurCityNo][i]**ALPHA) *( ( 1.0/Distance[self.m_nCurCityNo][i])**BETA )
                    dbTotal+=prob[i]
                else:
                    prob[i]=0.0
        
        #轮盘赌选择
        dbTemp=0.0
        if dbTotal>0.0:
            dbTemp=random.uniform(0,dbTotal)
            for i in range(n_citytemp):
                dbTemp-=prob[i]
                if dbTemp<0.0:
                    nSelectedCity=i 
                    break 
                
        if(nSelectedCity==-1 ):
            global c_chooseerror
            c_chooseerror+=1
            
            for i in range(n_citytemp):
                if flag==1:
                    if(citytemp[i].num>0):
                        nSelectedCity=i 
                        break 
                if flag==-1:
                    if(citytemp[i].num<0):
                        nSelectedCity=i 
                        break
        #print("nSelectedCity=",nSelectedCity)
        #print("ChooseNextCity end ...")
        return nSelectedCity
    
    def Move(self,citytemp,truck,Phrm,Distance):
        #print("CAnt Move start ...")
        p=Path()
        p.truckid=truck.truckid
        # //如果当前城市是-1，即蚂蚁处在初始位置时，
        #将该详细路径的sorce记录为【 [x_start,y_start] 】的形式
        if self.m_nCurCityNo==-1:
            p.source="["+str(self.x_start)+","+str(self.y_start)+"]"
        else:
            p.source=citytemp[self.m_nCurCityNo].name 
        
        if self.capacity>0:
            flag=-1
        else:
            flag=1 
        #print("self.capacity=",self.capacity)
        #print("flag=",flag )
        self.m_nCurCityNo=self.ChooseNextCity(citytemp,flag,Phrm,Distance)
        self.m_nPath.append(self.m_nCurCityNo)
        self.m_nMovedCityCount+=1
        #print("len=",len(self.m_nPath))
        #print(self.m_nPath)
        #os.system("pause ")
        
        p.target=citytemp[self.m_nCurCityNo].name
        #装货
        if flag==1:
            totaldemand=0
            for i in range(len(citytemp)):
                if citytemp[i].num<0:
                    totaldemand+=citytemp[i].num
            totaldemand=-totaldemand
            #print("totaldemand=",totaldemand)
            #print("len(citytemp)=",len(citytemp))
            
            num=citytemp[self.m_nCurCityNo].num 
            if(num<self.maxcapacity):
                if(totaldemand>num ):
                    self.capacity=citytemp[self.m_nCurCityNo].num 
                    #print("1")
                else:
                    self.capacity=totaldemand
                    #print("2")
            else:
                if(totaldemand<self.maxcapacity ):
                    self.capacity=totaldemand
                    #print("3")
                else:
                    self.capacity=self.maxcapacity
                    #print("4")
            #os.system("pause")
            citytemp[self.m_nCurCityNo].num-=self.capacity
            p.number=-self.capacity
            p.nowload=self.capacity
            
        #卸货
        if flag==-1 :
            num=-citytemp[self.m_nCurCityNo].num 
            if num < self.capacity: #需求量少于该车运载量，从车上卸货相应需求量即可
                self.capacity-=num 
                citytemp[self.m_nCurCityNo].num=0 
                p.number=num
                p.nowload=self.capacity
                 
            else:
                citytemp[self.m_nCurCityNo].num+=self.capacity
                p.number=self.capacity
                self.capacity=0
                p.nowload=0      
        self.path.append(p)
        #print("CAnt Move end ...")
        
    def CalPathLength(self,Distance ):
        #print("CAnt CalPathLength start ...")
        self.m_dbPathLength=0.0
        m=0
        n=0
        for i in range(2,self.m_nMovedCityCount):
            m=self.m_nPath[i]
            n=self.m_nPath[i-1]
            self.m_dbPathLength+=Distance[m][n]
        a=( self.x_start-city[self.m_nPath[1]].x)**2+( self.y_start-city[self.m_nPath[1]].y)**2
        a=a**0.5
        self.m_dbPathLength+=a
        #print("m_dbPathLength=",self.m_dbPathLength)
        #print("CAnt CalPathLength end ...")
        #print()
    def Search(self,citytemp,truck,Phrm,Distance):
        #print("CAnt Search start ...")
        self.Init( truck )
        while True:
            flag=False
            for i in range(len(citytemp)):
                if citytemp[i].num<0:
                    flag=True
                    break
            if flag==True:
                self.Move(citytemp, truck, Phrm, Distance)
            else:
                break
        
        self.CalPathLength(Distance)
        #print("CAnt Search end ...")
        
    def Pathchange(self):
        '''
        将number和nowload的含义改变
        原本number表示对target城市num的该变量，nowload表示在target改变之后的载货量
        将数组中前次Move路径中的number和nowload赋值给后一次路径中的number和nowload
        含义变为：number:对sorce城市num的该变量。 nowload:load after source change
        '''
        p=Path()
        p.truckid=self.truckid
        p.source=self.path[len(self.path)-1].target 
        p.target="null"
        p.number=self.path[len(self.path)-1].number 
        p.nowload=self.path[len(self.path)-1].nowload 
        self.path.append(p)
        #change
        for i in range(len(self.path)-2,-1,-1):
            self.path[i+1].number=self.path[i].number 
            self.path[i+1].nowload=self.path[i].nowload 
        self.path[0].number=0 
        self.path[0].nowload=0
        for i in range(len(self.path )):
            self.path[i].number=-self.path[i].number 
    def copy(self):
        temp=CAnt()
        temp.x=self.x 
        temp.y=self.y 
        temp.x_start=self.x_start
        temp.y_start=self.y_start
        temp.maxcapacity=self.maxcapacity
        temp.capacity=self.capacity
        temp.truckid=self.truckid
        temp.m_nPath=self.m_nPath.copy()
        temp.m_dbPathLength=self.m_dbPathLength
        temp.m_nCurCityNo=self.m_nCurCityNo
        temp.m_nMovedCityCount=self.m_nMovedCityCount
        temp.path=self.path.copy()
        return temp
               
class CDistribution:
    
    def __init__(self):
        self.dcity=[]
        self.Phrm= []
        self.Distance= []
        self.truck=Truck()
        self.m_cAntAry=[CAnt() for i in range(n_ant)]  
        self.m_cBestAnt=CAnt()
        
    def InitData(self):
        #print()
        #print("CDistribution InitData start ...")
        self.m_cBestAnt.path.clear()
        self.m_cBestAnt.m_dbPathLength=DB_MAX
        self.truck.Init()
        dcitynum=len(self.dcity)
        self.Distance=[ [1]*dcitynum for i in range(dcitynum)]
        #计算城市间距离矩阵
        for i in range(dcitynum ):
            for j in range(dcitynum ):
                dbTemp=(self.dcity[i].x-self.dcity[j].x)**2+(self.dcity[i].y-self.dcity[j].y)**2
                dbTemp=dbTemp**0.5
                self.Distance[i][j]=dbTemp
           
        #初始化信息素
        self.Phrm=[ [InitPhrm]*dcitynum for i in range(dcitynum) ]
        #print("CDistribution InitData end ...")
        
    def UpdatePhrm(self):
        #print("UpdatePhrm start ...")
        dnum=len(self.dcity)
        dbTempAry=[ [0.0]*dnum  for i in range(dnum )]
        #计算新信息素，保存到以上数组
        for i in range (n_ant ):
            for j in range(1,self.m_cAntAry[i].m_nMovedCityCount):
                m=self.m_cAntAry[i].m_nPath[j]
                n=self.m_cAntAry[i].m_nPath[j-1]
                dbTempAry[n][m]+=MaxPhrm/self.m_cAntAry[i].m_dbPathLength
                dbTempAry[m][n]=dbTempAry[n][m]
                
        #更新环境信息素 
        for i in range(dnum ):
            for j in range (dnum ):
                self.Phrm[i][j]=self.Phrm[i][j]*ROU + dbTempAry[i][j]
        #print("UpdatePhrm end ...")
        #输出更新后的信息素矩阵
        #for i in range(dnum ):
            #for j in range(dnum ):
                #print(round(self.Phrm[i][j]),end=" ")
            #print()
        #print("###################")
    def Search(self,truck ):
        #print("Distr.Search start ...")
        for i in range(n_iterator):
            for j in range(n_ant):
                citytemp=copy.deepcopy(self.dcity)
                #print("citytemp copy end")
                #for i in range(len(citytemp )):
                    #citytemp[i].Out()
                self.m_cAntAry[j].Search(citytemp,truck,self.Phrm,self.Distance)
            #保存最优解
            for j in range(n_ant ):
                if self.m_cAntAry[j].m_dbPathLength<self.m_cBestAnt.m_dbPathLength:
                    self.m_cBestAnt=self.m_cAntAry[j].copy()
                    
            self.UpdatePhrm()
            
        self.truck.truckpath=copy.deepcopy(self.m_cBestAnt.m_nPath)
        self.truck.n_pathnum=self.m_cBestAnt.m_nMovedCityCount
        self.truck.pathlen=self.m_cBestAnt.m_dbPathLength
        #print("Distr.Search end ...")
        #print()
                        
def ReadInJSON( ):
    f=codecs.open(INPUTJSON,"r","utf-8-sig")
    data=json.load(f )
    f.close()
    del f
    global n_city 
    global n_source
    global n_target
    n_source=len( data["sourcelist"] )
    n_target=len( data["targetlist"] )
    n_city=n_source+n_target
    c=[City() for i in range(n_city)]
    for i in range(n_source):
        c[i].x=data["sourcelist"][i]["x"]
        c[i].y=data["sourcelist"][i]["y"]
        c[i].num=data["sourcelist"][i]["num"]
        c[i].name=str("m"+str(i+1) )
    for i in range(n_target):
        j=n_source+i 
        c[j].x=data["targetlist"][i]["x"]
        c[j].y=data["targetlist"][i]["y"]
        c[j].num=-data["targetlist"][i]["num"]
        c[j].name=str("n"+str(i+1) )
    for i in range(n_city):
        city.append( c[i] )
    del c
    #卡车信息读入
    global DistrSize
    DistrSize=len( data["trucklist"] )
    t=[Truck() for i in range(DistrSize)]
    for i in range(DistrSize):
        t[i].truckid=i+1
        t[i].x=data["trucklist"][i]["x"]
        t[i].y=data["trucklist"][i]["y"]
        t[i].maxcapacity=data["trucklist"][i]["capacity"]
    cd=[CDistribution() for i in range(DistrSize)]
    for i in range(DistrSize):
        cd[i].truck=t[i]
    for i in range(DistrSize):
        Distr.append(cd[i])
    del t 
    del cd 
        
def CreatGroup(citygroup,citygroupnum ):
    for i in range(n_source):
        city[i].group=-1
    for i in range(n_source,n_city):
        city[i].group=random.randrange(0,DistrSize)
    for i in range(n_city):
        if city[i].group==-1:
            for j in range(DistrSize):
                citygroup[j].append(i)
        else:
            g=city[i].group
            citygroup[g].append(i)
            
    for i in range(DistrSize):
        citygroupnum[i]=len(citygroup[i])     
    #print("citygroup:",citygroup)
    #print("citygroupnum:",citygroupnum)
  
def CreatRandNo(na_RandNo ):
    #print("CreatRandNo start ...")
    for i in range(DistrSize):
        na_RandNo[i]=random.randrange(0,DistrSize)
        flag=True
        while flag:
            flag=False 
            for j in range(i ):
                if na_RandNo[i]==na_RandNo[j]:
                    na_RandNo[i]=random.randrange(0,DistrSize)
                    flag=True
    #print(na_RandNo)
    #print("CreatRandNo end ...")
                          
def JudgeNoDemander(citygroupnum,n_supportnum ):
    for i in range(DistrSize):
        if citygroupnum[i]<n_supportnum+1:
            #print("No demander ...")
            return True
    
    return False                       
 
def JudgeRandNo(na_RandNo,na_PastRandNo ):
    #print("JudgeRandNo start...")
    flag=False
    if len(na_PastRandNo)==0:
        #print("len(na_PastRandNo)==0, can be used ")
        return False
    else:
        for i in range(len(na_PastRandNo)):
            f=True
            for j in range(DistrSize):
                if na_RandNo[j]!=na_PastRandNo[i][j]:
                    f=False
                    break
            if f==True:
                flag=True
                break
        if flag==True:
            #print("na_RandNo has existed...")
            return True
        else:
            a=copy.deepcopy(na_RandNo)
            na_PastRandNo.append(a)
            #print("na_RandNo can be used ...")
            return False
            
def UpdateCityModel(citytmp,Distr):  
    #print("UpdateCityModel start ...")
    if Distr.truck.n_pathnum==1:
        #print("Distr.truck.n_pathnum==1,continue") 
        return
    for j in range(len(citytmp)):
        for k in range(len(Distr.m_cBestAnt.path)):
            if Distr.m_cBestAnt.path[k].target==citytmp[j].name :
                citytmp[j].num+=Distr.m_cBestAnt.path[k].number
    #print("UpdateCityModel end  ...")
def ChangeDcity(Distr ,bestcitygroup):
    #print("ChangeDcity start ...")
    for i in range(DistrSize):
        Distr[i].dcity.clear()
        for j in range(len(bestcitygroup[i])):
            NO=bestcitygroup[i][j]
            Distr[i].dcity.append(city[NO])
    #print("Change dcity ok ...")  
            
def STDPrint(Distr,bestcitygroup ):
    print("STDPrint start...")
    print("")
    print("bestcitygroup")
    for i in range(DistrSize):
        print("Distr[",i,"]:",end=" ")
        for j in range( len(bestcitygroup[i])  ):
            print(bestcitygroup[i][j],end=" ")
        print()  
        
    for i in range(DistrSize):
        print("truck",i+1,":",end=" ")
        for j in range(Distr[i].truck.n_pathnum):
            if Distr[i].m_cBestAnt.m_nPath[j]==-1:
                print("[",Distr[i].m_cBestAnt.x_start,",",Distr[i].m_cBestAnt.y_start,"]",end= " ")
            else:
                print(",\"",Distr[i].dcity[ Distr[i].m_cBestAnt.m_nPath[j] ].name ,"\"",end="")
        print()
    print()
    mxlen=0
    totallen=0
    for i in range(DistrSize):
        print("truck",i+1,"'s pathlen = ",Distr[i].truck.pathlen )
        totallen+=Distr[i].truck.pathlen
        if Distr[i].truck.pathlen>mxlen:
            mxlen=Distr[i].truck.pathlen 
    
    print("The total length of all the trucks is 【",totallen,"】")
    print("The least time to finish all the distribution works is 【",mxlen,"/speed】")
    print()
    print("STDPrint end...")
    
def FilePrint(Distr,Trun ):
    print("FilePrint start...")
    for i in range(DistrSize):
        #print("i=",i)
        #print("Distr[i].m_cBestAnt.path.size()=",len(Distr[i].m_cBestAnt.path))
        Distr[i].m_cBestAnt.Pathchange()
        #print("Pathchange  ok ...")
        for j in range(len(Distr[i].m_cBestAnt.path)):
            Distr[i].truck.path.append((Distr[i].m_cBestAnt.path[j]))
        #print("all path change ok ... ")
        
    #out to OutJSON.txt
    temp = open('/var/www/mysite/vrp/static/temp.txt', 'r')
    name = temp.read()
    name = str(name)
    f=open('/var/www/mysite/'+name,"w")
    data={}
    data["record"]=[]
    data["pathlist"]=[]
    data["time"]=Trun 
    for i in range(DistrSize):
        for j in range(len(Distr[i].truck.path) ):
            rcd={}
            rcd["truckid"]=Distr[i].truck.path[j].truckid 
            if len(Distr[i].truck.path[j].source)>2:
                rcd["source"]=[]
                rcd["source"].append(Distr[i].truck.x)
                rcd["source"].append(Distr[i].truck.y )
            else:
                rcd["source"]=Distr[i].truck.path[j].source 
            rcd["target"]=Distr[i].truck.path[j].target 
            rcd["number"]=Distr[i].truck.path[j].number 
            rcd["nowload"]=Distr[i].truck.path[j].nowload
            data["record"].append(rcd )
    for i in range(DistrSize):
        pl={}
        pl["truckid"]=i+1
        pl["path"]=[]
        for j in range(len(Distr[i].truck.truckpath) ):
            if(Distr[i].truck.truckpath[j]==-1):
                s=[]
                s.append(Distr[i].truck.x)
                s.append(Distr[i].truck.y )
                pl["path"].append(s )
            else:
                NO=Distr[i].truck.truckpath[j]
                s=Distr[i].dcity[NO].name
                pl["path"].append(s) 
        data["pathlist"].append(pl)
        
    json.dump(data,f)
    f.close()
    print("FilePrint end ...")
        


#===============================================================================
# main
#===============================================================================


'''
main     
main
'''
Tstart=time.clock()
ReadInJSON()

D=0
D=DistrSize
n_iterator=3*D
if D<=5 :      
    n_iter_group=D**2*10
    n_iter_randNo=D**2*2
else:
    D=D//2+1
    n_iter_group=D**2*10
    n_iter_randNo=D**2


print(INPUTJSON)
print("n_iterator=",n_iterator)
print("n_iter_group=",n_iter_group)
print("n_iter_randNo=",n_iter_randNo)
print()
for i in range(n_city):
    city[i].Out()
print("DistrSize=",DistrSize)
for i in range(DistrSize):
    Distr[i].truck.Out()
print("Please wait ...")
#os.system("pause") 

citygroupnum=[0 for i in range(DistrSize)] 
bestcitygroup=[]
resultAnt=[ CAnt() for i in range(DistrSize) ]
resultTruck=[ Truck() for i in range(DistrSize)]
shortestPathLen=DB_MAX
it=0
while it<=n_iter_group:
    it=it+1
    citygroup=[[] for i in range (DistrSize)]
    CreatGroup(citygroup, citygroupnum)
    c_creatgroupnum=c_creatgroupnum+1
    #===========================================================================
    #
    #===========================================================================
    if JudgeNoDemander(citygroupnum, n_source ):
        c_creatgrouperr=c_creatgrouperr+1
        if it>n_iter_group :
            if c_creatgroupnum-c_creatgrouperr<=2:
                it=it-1
            it=it-1
        continue
    #===========================================================================
    # 
    #===========================================================================
    na_PastRandNo=[]
    flag_updata=False
    for ite in range(n_iter_randNo):
        na_RandNo=[0 for i in range(DistrSize)]
        CreatRandNo(na_RandNo)
        if JudgeRandNo(na_RandNo, na_PastRandNo):
            continue
        #print("*************")
        citytmp=copy.deepcopy(city)
        #print("city copy end ...")
        flag_break=False
        for i in range(DistrSize):
            Distr[na_RandNo[i]].dcity.clear()
            for j in range(citygroupnum[na_RandNo[i]] ):
                Distr[na_RandNo[i]].dcity.append(citytmp[ citygroup[ na_RandNo[i] ][j] ])
            
            #任务初始化
            Distr[na_RandNo[i]].InitData()
            
            totalsupply=0
            totaldemand=0
            for j in range(len( Distr[ na_RandNo[i] ].dcity) ):
                if Distr[na_RandNo[i]].dcity[j].num>0:
                    totalsupply+=Distr[na_RandNo[i]].dcity[j].num
                if Distr[na_RandNo[i]].dcity[j].num<0:
                    totaldemand+=Distr[na_RandNo[i]].dcity[j].num
            totaldemand=-totaldemand
            if totaldemand>totalsupply:
                flag_break=True
                break
            #开始搜索
            #print("main Search start ...")
            Distr[na_RandNo[i]].Search(Distr[na_RandNo[i]].truck)
            #print("main Search end ...")
            UpdateCityModel(citytmp, Distr[na_RandNo[i]]) 
         
        if(flag_break==True):
            continue
        flag_nofinish=False
        for i in range(len(citytmp)):
            if citytmp[i].num<0:
                flag_nofinish=True
                break
        if flag_nofinish==True:
            c_nofinish+=1
            continue
        
        shortPathlen=0
        for i in range(DistrSize):
            if Distr[i].truck.pathlen>shortPathlen:
                shortPathlen=Distr[i].truck.pathlen
        
        if( (flag_updata==False)and (shortPathlen>shortestPathLen*2) ):
            c_skipgroup+=1
            break
        if shortPathlen<shortestPathLen:
            flag_updata=True
            c_updata+=1
            shortestPathLen=shortPathlen
            for i in range(DistrSize):
                resultAnt[i]=Distr[i].m_cBestAnt.copy()
                resultTruck[i]=Distr[i].truck.copy()
            bestcitygroup=copy.deepcopy(citygroup)
                    
        #print("ite=",ite )
        #os.system("pause")
    #print("it=",it )
    #os.system("pause")

print ("c_creatgroupnum=",c_creatgroupnum)
print ("c_creatgrouperr=",c_creatgrouperr)
ChangeDcity(Distr, bestcitygroup)

for i in range(DistrSize):
    Distr[i].m_cBestAnt=resultAnt[i].copy()
    Distr[i].truck=resultTruck[i].copy()
    
Tend=time.clock()
Trun=Tend-Tstart
Trun=round(Trun,3)
#结果输出
FilePrint(Distr, Trun)
STDPrint(Distr, bestcitygroup)
print("c_skipgroup=",c_skipgroup)
print("c_updata=",c_updata)
print("c_choosecity=",c_choosecity)
print("c_chooseerror=",c_chooseerror)
print("c_nofinish=",c_nofinish)

     
print()
print("Calculate ok... Run time is ",Trun)
print("OutJSON.txt is writen    ok ...")

    

    


