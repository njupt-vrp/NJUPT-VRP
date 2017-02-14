# -*- coding: cp936 -*-
#-*- coding:utf-8 –*-
import json
import random
import math
import copy
import operator
import time
def initread(initcity,lackcity,car):#传入城市列表,需求城市列表，小车列表
    inputjson = open("vrp/static/inputjson.txt").read()
    a=json.loads(inputjson)
    for i in range(len(a["sourcelist"])):
                   city.append([a["sourcelist"][i]["x"],a["sourcelist"][i]["y"],a["sourcelist"][i]["num"]])
    for i in range(len(a["targetlist"])):
                   lackcity.append(len(city))#记录下第几个城市需要物资
                   city.append([a["targetlist"][i]["x"],a["targetlist"][i]["y"],-a["targetlist"][i]["num"]])
    for i in range(len(a["trucklist"])):
                   initcar.append([a["trucklist"][i]["x"],a["trucklist"][i]["y"],a["trucklist"][i]["capacity"]])
    return;
def initgroup(city,num,lackcity,initcar,group):#依次为城市列表，种群大小，需求城市列表,染色体组
    for i in range(num):
        group.append([])
        for j in range(3):#每一个染色体包含3个内容
            group[i].append([])
        possess=[]
        for j in range(len(city)):
            possess.append(city[j][2])#备份城市物资数量
        car=[]#要使用car[i]都为列表
        for j in range(len(initcar)):
            car.append([])
        j=0;
        while(j<len(lackcity)):
            while True:
                tempstart = random.randint(0,len(city)-1)#随机生成一个起点
                if (possess[tempstart]>0):
                    break;
            tempcar=random.randint(0,len(initcar)-1)#随机一辆小车运送
            if (possess[tempstart]>=initcar[tempcar][2]):#如果起点城市物资大于等于小车运量
                possess[tempstart]=possess[tempstart]-initcar[tempcar][2]#起点失去物资
                possess[lackcity[j]]=possess[lackcity[j]]+initcar[tempcar][2]#终点失去物资
                car[tempcar].append([tempstart,lackcity[j],initcar[tempcar][2]])
            else:#如果起点城市物资小于小车的运量
                possess[lackcity[j]]=possess[lackcity[j]]+possess[tempstart]
                car[tempcar].append([tempstart,lackcity[j],possess[tempstart]])
                possess[tempstart]=0#起点城市运量变为0
            if (possess[lackcity[j]]>=0):
                j=j+1
        group[i][0]=car;
    return;
def calculate(c,d,c1,d1):
    return math.sqrt(((c-c1)*(c-c1)*1.0+(d-d1)*(d-d1)*1.0))
def evalute(city,lackcity,initcar,group,num,flag,T):
    for i in range(num):   
        biggestsum=0
        for j in range(len(initcar)):
            sumdistance=0; 
            x=initcar[j][0]#车的起点
            y=initcar[j][1]#车的终点
            for k in range(len(group[i][0][j])):#每一个染色体每一辆小车的
                sumdistance=sumdistance+calculate(x,y,city[group[i][0][j][k][0]][0],city[group[i][0][j][k][0]][1])
                sumdistance=sumdistance+calculate(city[group[i][0][j][k][0]][0],city[group[i][0][j][k][0]][1],city[group[i][0][j][k][1]][0],city[group[i][0][j][k][1]][1])
                x=city[group[i][0][j][k][1]][0]#更新为这次的终点
                y=city[group[i][0][j][k][1]][1]
            biggestsum=max(biggestsum,sumdistance);#每一辆小车运送完，看看是不是最长的路径
        if (flag[i]!=0):#如果需要引入罚函数
            group[i][1]=biggestsum*flag[i]*T;
        else:#否则直接赋值
            group[i][1]=biggestsum;
    for i in range(num):
        group[i][2]=(1.0/group[i][1]*num*len(city))
   # for  i in range(num):
        #print group[i][1]
        #print group[i][2]
    return;

def choose(num,group):
    gradient=[]
    grouptemp=[]
    gradient.append(group[0][2])#第一个就是它自己的概率
    xuan=[]
    for i in range(num):
        xuan.append([])
    for i in range(1,num):
        gradient.append(gradient[i-1]+group[i][2])#累计概率值
    sump=int(gradient[num-1])
    for i in range(1,num):
        t=random.uniform(0,sump)
        for j in range(num):#找到第一个大于随机出来的数（这里要包含0)
            if (gradient[j]>=t):
                xuan[i].append(j)
                break
    grouptemp=copy.deepcopy(group)#复制原来的group列表
    for i in range(1,num):#第一个直接避免选择
        temp=xuan[i][0]#其他的就是原来选择的第几条染色体，就直接复制
        group[i]=copy.deepcopy(grouptemp[temp])
    return;
   
def toselect(group):
    group.sort(key=operator.itemgetter(1))
    #for i in range(num):
        #print group[i][1]
        #print group[i][2]
    #return;
    #group第一个变量是第几条染色体，第二个是0，第三个是第几辆车,第四个是第几次运送，第五个0是起点，1是终点,2是运量
def jiaopei(group,pm,carnumber,value):#group种群，pc交配概率
    num=len(group)
    jiaopeiobject=[]
    for i in range(1,num):
        jiaopeip=random.randint(0,100)
        if (jiaopeip/1.0/100<pm):#如果符合交配条件
            jiaopeiobject.append(i)
    lenjiaopeiobject=len(jiaopeiobject)#计算需要交配的个数
    lenjiaopeiobject=lenjiaopeiobject//2*2#保证个数为偶数
    c=0;
    d=1;
    for i  in range(lenjiaopeiobject//2):
        temp1=jiaopeiobject[c];#需要变异的染色体
        temp2=jiaopeiobject[d];
        c=c+2;
        d=d+2;
        point1=random.randint(0,carnumber-1)#随机两辆车
        point2=random.randint(0,carnumber-1)
        switch=random.randint(0,1)#随机一个选择，如果是0则往后传递，否则往前传递
        k=kk=0
        j=point1
        jj=point2
        while((j<carnumber)and(jj<carnumber)):#当没最后一辆小车运完
            while((k<len(group[temp1][0][j])) and (kk<len(group[temp2][0][jj]))):
                while ((k<len(group[temp1][0][j]))and (group[temp1][0][j][k][2]!=value)):
                       k=k+1
                while((kk<len(group[temp2][0][jj])) and (group[temp2][0][jj][kk][2]!=value)):
                       kk=kk+1
                if ((k<len(group[temp1][0][j])) and (kk<len(group[temp2][0][jj]))  and (group[temp1][0][j][k][0]!=group[temp2][0][jj][kk][1]) and (group[temp1][0][j][k][0]!=group[temp2][0][jj][kk][1]) and (group[temp1][0][j][k][1]!=group[temp2][0][jj][kk][0])):
                       temp=group[temp1][0][j][k][0]
                       group[temp1][0][j][k][0]=group[temp2][0][jj][kk][0]
                       group[temp2][0][jj][kk][0]=temp
                k=k+1
                kk=kk+1
            if (k>=len(group[temp1][0][j])):
                k=0
                j=j+1
            if (kk>=len(group[temp2][0][jj])):
                kk=0;
                jj=jj+1
    return;
   
def bianyi(group,pc,carnumber,value,flag,startnumber):
    num=len(group)
    bianyiflag=[]
    for i in range(1,num):
        bianyip=random.randint(0,100)
        if (bianyip/1.0/100<pc):
            bianyiflag.append(i)
    l=len(bianyiflag)
    for r in range(l):
        i=bianyiflag[r]#需要变异的染色体
        rand=random.randint(0,2)#选择变异的方式把temp1小车的第temp3次任务转交给第temp2辆小车的第temp4次任务
        if (rand==0):
            while True:
                temp1=random.randint(0,carnumber-1)#随机选取两辆小车
                if (len(group[i][0][temp1])>0):
                    break;
            temp2=random.randint(0,carnumber-1)
            temp3=random.randint(0,len(group[i][0][temp1])-1)
            temp4=random.randint(0,len(group[i][0][temp1]))#可以插在最后
            group[i][0][temp2].insert(temp4,group[i][0][temp1][temp3])#把temp1小车的第temp3次任务转交给第temp2辆小车的第temp4次任务
            del group[i][0][temp1][temp3]#删除temp1小车的第temp3项任务
        if (rand==1):#如果是终点交换
            while True:
                temp1=random.randint(0,carnumber-1)
                if (len(group[i][0][temp1])>0):
                    break;
            while True:
                    temp2=random.randint(0,carnumber-1)
                    if (len(group[i][0][temp2])>0):
                        break;
            temp3=random.randint(0,len(group[i][0][temp1])-1)#对于每一辆随机随机一个运送次数
            temp4=random.randint(0,len(group[i][0][temp2])-1)
            if ((group[i][0][temp1][temp3][1]!=group[i][0][temp2][temp4][0]) and (group[i][0][temp1][temp3][0]!=group[i][0][temp2][temp4][1]) and (group[i][0][temp1][temp3][2]==group[i][0][temp2][temp4][2])):
                        tempend=group[i][0][temp1][temp3][1]
                        group[i][0][temp1][temp3][1]=group[i][0][temp2][temp4][1]
                        group[i][0][temp2][temp4][1]=tempend
            elif (((group[i][0][temp1][temp3][1]==group[i][0][temp2][temp4][0]) and (temp4==0))or ((group[i][0][temp1][temp3][1]==group[i][0][temp2][temp4][0]) and (group[i][0][temp2][temp4-1][1]!=group[i][0][temp2][temp4][0]))):
                        flag[i]=flag[i]+1
            elif (((group[i][0][temp1][temp3][0]==group[i][0][temp2][temp4][1]) and (temp3==0)) or ((group[i][0][temp1][temp3][0]==group[i][0][temp2][temp4][1]) and (group[i][0][temp1][temp3][0]!=group[i][0][temp1][temp3-1][0]))):
                        flag[i]=flag[i]+1
        if (rand==2):
            while True:
                temp1=random.randint(0,carnumber-1)#选取一辆小车
                if (len(group[i][0][temp1])>0):
                        break;
                        temp2=random.randint(0,len(group[i][0][temp1])-1)
                        while True:
                            temp3=random.randint(0,startnumber-1)#再随机一个起点
                            if ((temp3!=group[i][0][temp1][temp2][0]) and (temp3!=group[i][0][temp1][temp2][1])):#避免出现头尾相等的情况
                                group[i][0][temp1][temp2][0]=temp3
                                break;
    return;
def judge(group,carnumber,city,flag,initcar,startnumber):
    cities=len(city)
    for k in range(cities):#对于每一个城市
        for i in range(num):
            check=[]
            for j in range(carnumber):
                goaldistance=0
                if (len(group[i][0][j])>0):
                    goaldistance=goaldistance+calculate(initcar[j][0],initcar[j][1],city[group[i][0][j][0][0]][0],city[group[i][0][j][0][0]][1])
                    for t in range(len(group[i][0][j])-1):
                        if (group[i][0][j][t][0]==k):
                            check.append([-group[i][0][j][t][2],goaldistance])
                        goaldistance=goaldistance+calculate(city[group[i][0][j][t][0]][0],city[group[i][0][j][t][0]][1],city[group[i][0][j][t][1]][0],city[group[i][0][j][t][1]][1])
                        if (group[i][0][j][t][1]==k):
                            check.append([group[i][0][j][t][2],goaldistance])
                        goaldistance=goaldistance+calculate(city[group[i][0][j][t][1]][0],city[group[i][0][j][t][1]][1],city[group[i][0][j][t+1][0]][0],city[group[i][0][j][t+1][0]][1])
                    t=len(group[i][0][j])-1
                    if (group[i][0][j][t][0]==k):
                        check.append([-group[i][0][j][t][2],goaldistance])
                    goaldistance=goaldistance+calculate(city[group[i][0][j][t][0]][0],city[group[i][0][j][t][0]][1],city[group[i][0][j][t][1]][0],city[group[i][0][j][t][1]][1])
                    if (group[i][0][j][t][1]==k):
                        check.append([group[i][0][j][t][2],goaldistance])
            possess=city[k][2]
            check.sort(key=operator.itemgetter(1))
            if (k<startnumber):
                for j in range(len(check)):
                    possess=possess+check[j][0]
                    if possess<0:
                        flag[i]=flag[i]+1
                        break;
            else:
                sign=0
                for j in range(len(check)):
                    possess=possess+check[j][0]
                    if (sign==0):
                        if (possess>=0):
                            sign=1
                        if (check[j][0]<0):
                            flag[i]=flag[i]+1
                            break;
                    else:
                        if (possess<0):
                            flag[i]=flag[i]+1
                            break;
                if (possess<0):
                    flag[i]=flag[i]+1
            
    return;
                
                
                        
                
        
                              
                        
                        
                        
def Print(group,initcar,startnumber,TIME):
    temp = open('/var/www/mysite/vrp/static/temp.txt', 'r')
    name = temp.read()
    name = str(name)
    f=open('/var/www/mysite/'+name,"wb+")
    f.write(bytes("{\n",'utf-8'))
    f.write(bytes("\"record\":\n",'utf-8'))
    f.write(bytes("[",'utf-8'))
    j=0
    
    for t in range(carnumber):
        if (len(group[j][0][t])!=0):
            f.write(bytes("{\n",'utf-8'))
        k=-1
        for k in range(len(group[j][0][t])):
            if (k==0):
                f.write(bytes("\"truckid\":%d,\n"%(t+1),'utf-8'))
                f.write(bytes("\"source\":[%d,%d],\n"%(initcar[t][0],initcar[t][1]),'utf-8'))
                f.write(bytes("\"target\":\"%s%d\",\n"%(chr(109+group[j][0][t][k][0]//startnumber),group[j][0][t][k][0]%startnumber+1),'utf-8'))
                f.write(bytes("\"number\":0,\n",'utf-8'))
                f.write(bytes("\"nowload\":0\n",'utf-8'))
                f.write(bytes("},\n",'utf-8'))
                f.write(bytes("{\n",'utf-8'))
                f.write(bytes("\"truckid\":%d,\n"%(t+1),'utf-8'))
                f.write(bytes("\"source\":\"%s%d\",\n"%(chr(109+group[j][0][t][k][0]//startnumber),group[j][0][t][k][0]%startnumber+1),'utf-8'))
                f.write(bytes("\"target\":\"%s%d\",\n"%(chr(109+group[j][0][t][k][1]//startnumber),group[j][0][t][k][1]%startnumber+1),'utf-8'))
                f.write(bytes("\"number\":%d,\n"%(group[j][0][t][k][2]),'utf-8'))
                f.write(bytes("\"nowload\":%d\n"%(group[j][0][t][k][2]),'utf-8'))
                f.write(bytes("},\n",'utf-8'))
            else:
                if (group[j][0][t][k-1][1]!=group[j][0][t][k][0]):
                    f.write(bytes("{\n",'utf-8'))
                    f.write(bytes("\"truckid\":%d,\n"%(t+1),'utf-8'))
                    f.write(bytes("\"source\":\"%s%d\",\n"%(chr(109+group[j][0][t][k-1][1]//startnumber),group[j][0][t][k-1][1]%startnumber+1),'utf-8'))
                    f.write(bytes("\"target\":\"%s%d\",\n"%(chr(109+group[j][0][t][k][0]//startnumber),group[j][0][t][k][0]%startnumber+1),'utf-8'))
                    f.write(bytes("\"number\":-%d,\n"%(group[j][0][t][k-1][2]),'utf-8'))
                    f.write(bytes("\"nowload\":0\n",'utf-8'))
                    f.write(bytes("},\n",'utf-8'))
                    f.write(bytes("{\n",'utf-8'))
                    f.write(bytes("\"truckid\":%d,\n"%(t+1),'utf-8'))
                    f.write(bytes("\"source\":\"%s%d\",\n"%(chr(109+group[j][0][t][k][0]//startnumber),group[j][0][t][k][0]%startnumber+1),'utf-8'))   
                    f.write(bytes("\"target\":\"%s%d\",\n"%(chr(109+group[j][0][t][k][1]//startnumber),group[j][0][t][k][1]%startnumber+1),'utf-8'))
                    f.write(bytes("\"number\":%d,\n"%(group[j][0][t][k][2]),'utf-8'))
                    f.write(bytes("\"nowload\":%d\n"%(group[j][0][t][k][2]),'utf-8'))
                    f.write(bytes("},\n",'utf-8'))
                else:
                    f.write(bytes("{\n",'utf-8'))
                    f.write(bytes("\"truckid\":%d,\n"%(t+1),'utf-8'))
                    f.write(bytes("\"source\":\"%s%d\",\n"%(chr(109+group[j][0][t][k][0]//startnumber),group[j][0][t][k][0]%startnumber+1),'utf-8'))
                    f.write(bytes("\"target\":\"%s%d\",\n"%(chr(109+group[j][0][t][k][1]//startnumber),group[j][0][t][k][1]%startnumber+1),'utf-8'))
                    f.write(bytes("\"number\":%d,\n"%(group[j][0][t][k][2]-group[j][0][t][k-1][2]),'utf-8'))
                    f.write(bytes("\"nowload\":%d\n"%(group[j][0][t][k][2]),'utf-8'))
                    f.write(bytes("},\n",'utf-8'))
        if (k!=-1):
            f.write(bytes("{\n",'utf-8'))
            f.write(bytes("\"truckid\":%d,\n"%(t+1),'utf-8'))
            f.write(bytes("\"source\":\"%s%d\",\n"%(chr(109+group[j][0][t][k][1]//startnumber),group[j][0][t][k][1]%startnumber+1),'utf-8'))
            f.write(bytes("\"target\":\"null\",\n",'utf-8'))
            f.write(bytes("\"number\":-%d,\n"%(group[j][0][t][k][2]),'utf-8'))
            f.write(bytes("\"nowload\":0\n",'utf-8'))
            f.write(bytes("},\n",'utf-8'))
    f.seek(-2,1)
    f.write(bytes("\n",'utf-8'))
    f.write(bytes("]\n,\n",'utf-8'))
    f.write(bytes("\"pathlist\":\n",'utf-8'))
    f.write(bytes("[\n",'utf-8'))
    for t in range(carnumber):
        f.write(bytes("{\n",'utf-8'))
        f.write(bytes("\"truckid\":%d,\n"%(t+1),'utf-8'))
        f.write(bytes("\"path\":[",'utf-8'))
        k=-1
        for k in range(len(group[j][0][t])):
            if (k==0):
                f.write(bytes("[%d,%d]"%(initcar[t][0],initcar[t][1]),'utf-8'))
                f.write(bytes(",\"%s%d\""%(chr(109+group[j][0][t][0][0]//startnumber),group[j][0][t][0][0]%startnumber+1),'utf-8'))
            elif(group[j][0][t][k-1][1]==group[j][0][t][k][0]):
                f.write(bytes(",\"%s%d\""%(chr(109+group[j][0][t][k][0]//startnumber),group[j][0][t][k][0]%startnumber+1),'utf-8'))
            else:
                f.write(bytes(",\"%s%d\""%(chr(109+group[j][0][t][k-1][1]//startnumber),group[j][0][t][k-1][1]%startnumber+1),'utf-8'))
                f.write(bytes(",\"%s%d\""%(chr(109+group[j][0][t][k][0]//startnumber),group[j][0][t][k][0]%startnumber+1),'utf-8'))
        if (k!=-1):
            f.write(bytes(",\"%s%d\""%(chr(109+group[j][0][t][k-1][1]//startnumber),group[j][0][t][k][1]%startnumber+1),'utf-8'))
        f.write(bytes("]\n},\n",'utf-8'))
    f.seek(-2,1);
    f.write(bytes("\n",'utf-8'));
    f.write(bytes("]\n",'utf-8'))
    f.write(bytes(",\n",'utf-8'))
    f.write(bytes("\"time\":%.4f"%(TIME),'utf-8'))
    f.write(bytes("}\n",'utf-8'))
    f.close();
    return;

                
                
      
        
        
                    
             
                    
                    
                    
                
                
                        
                        
        
        
        










city=[]
lackcity=[]
initcar=[]
num=100;#种群大小
group=[]
flag=[]
pm=0.8
pc=0.8
MAX=5000
t=1;#迭代次数
start=time.clock()
for i in range(num):
    flag.append(0)
T=5;#计算时间的惩罚基数
initread(city,lackcity,initcar)#初始化读入
startnumber=len(city)-len(lackcity)
carnumber=len(initcar)
value=initcar[0][2]#车最大载货量
initgroup(city,num,lackcity,initcar,group)#初始化种群
while(t<MAX):
    evalute(city,lackcity,initcar,group,num,flag,T)#计算评估函数
    toselect(group)#筛选出优秀解，并排序
    choose(num,group)#选择下一代的新种群
    for i in range(num):
        flag[i]=0
    jiaopei(group,pm,carnumber,value)
    bianyi(group,pc,carnumber,value,flag,startnumber)
    T=T*1.001
    judge(group,carnumber,city,flag,initcar,startnumber)
    t=t+1
evalute(city,lackcity,initcar,group,num,flag,T)#计算评估函数
toselect(group)#筛选出优秀解，并排序
end=time.clock()
Print(group,initcar,startnumber,end-start)
#print group[99]
#print lacknum
#print cities
#print city
#print lackcity
#print car
#print carnumber



 
