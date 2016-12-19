#include <iostream>
#include <math.h>
#include <time.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <vector>
#include <windows.h>
#include <fstream>
#include<json/json.h>
#include<jsoncpp.h>
using namespace std;


int c_skipgroup=0;
int c_update=0;
int c_choosecity=0;
int c_chooseerror=0;
int c_nofinish=0;


#define INPUTJSON "vrp/static/inputjson.txt"
const double ALPHA=2.0; //启发因子，信息素的重要程度
const double BETA=1.0;   //期望因子，城市间距离的重要程度
const double ROU=0.5; //信息素残留参数

const int n_ant=3; //蚂蚁数量
int n_iterator=100; //蚂蚁迭代次数
int n_iter_group=300;//重复分组次数。
int n_iter_randNo=20;//子任务序列随机次数
const int n_city=50; //城市数量

const double MaxPhrm=1000.0; //总的信息素
const double InitPhrm=0.0;  //初始信息素
const double DB_MAX=10e9; //一个标志数，10的9次方

int DistrSize;
int citynum;
int n_source;
int n_target;

class City;  //类的超前声明

vector<City> city;  //定义全局变量


//返回指定范围内的随机整数
int rnd(int nLow,int nUpper)
{
    return nLow+(nUpper-nLow)*rand()/(RAND_MAX+1);
}

//返回指定范围内的随机浮点数
double rnd(double dbLow,double dbUpper)
{
    double dbTemp=rand()/((double)RAND_MAX+1.0);
    return dbLow+dbTemp*(dbUpper-dbLow);
}

//返回浮点数四舍五入取整后的浮点数
double ROUND(double dbA)
{
    return (double)((int)(dbA+0.5));
}


class City
{
public:
    int x;    //x,y,为此城市的位置坐标
    int y;
    int num;//正为供应地，负为需求地
    char name[10];
    int group;
    friend ostream &operator <<(ostream& out,City c);
};
ostream &operator <<(ostream& out,City c)
{
    out<<c.name<<" ";
    out<<"("<<c.x<<","<<c.y<<")";
    out<<" "<<c.num<<endl;
}

//定义路径类，详细记录卡车路径
class Path
{
public:
    int truckid;
    char source[10];
    char target[10];
    int number;  //目的地num改变量
    int nowload; //目的地后的载货量
    friend void operator <<(ostream &out,Path &p)  //JSON格式输出
    {
        out<<"{"<<endl;
        out<<"\"truckid\":"<<p.truckid<<","<<endl;
        if(p.source[0]=='[')
            out<<"\"source\":"<<p.source<<","<<endl;
        else
            out<<"\"source\":\""<<p.source<<"\","<<endl;

        out<<"\"target\":\""<<p.target<<"\","<<endl;
        out<<"\"number\":"<<p.number<<","<<endl;
        out<<"\"nowload\":"<<p.nowload<<endl;
        out<<"}";
    }
};
class Truck
{
public:
    int x;    //x,y,为此卡车的初始位置坐标
    int y;
    int maxcapacity;//最大载货量
    int capacity;//当前载货量
    int truckid;
    int truckpath[50];
    int n_pathnum;
    double pathlen;
    vector<Path> path;
    Truck& operator = (Truck & B );
    friend ostream &operator <<(ostream& out, Truck truck );
    void Init();
};
//初始化工作
void Truck::Init()
{
    memset(truckpath,0,sizeof(truckpath));
    n_pathnum=0;
    pathlen=0;
    vector<Path>().swap(path);
}
ostream &operator <<(ostream& out,Truck truck )
{
    out<<"truckid = "<<truck.truckid;
    out<<" ("<<truck.x<<","<<truck.y<<")";
    out<<" "<<truck.maxcapacity;
    out<<" "<<truck.capacity<<endl;
}
//Truck类的等号重载
Truck& Truck::operator =(Truck & B)
{
    x=B.x;
    y=B.y;
    maxcapacity=B.maxcapacity;
    capacity=B.capacity;
    truckid=B.truckid;
    for(int i=0;i<50;i++)
        truckpath[i]=B.truckpath[i];
    n_pathnum=B.n_pathnum;
    pathlen=B.pathlen;
    vector<Path>().swap(path);
    for(int i=0;i<B.path.size();i++)
        path.push_back(B.path[i]);
}


class CAnt
{
public:
    int x; //蚂蚁的坐标
    int y;
    int x_start;//蚂蚁初始位置
    int y_start;
    int capacity;//蚂蚁的当前载重
    int maxcapacity;//最大载重量
    int truckid;
    CAnt(void);
    ~CAnt(void);

    int m_nPath[50]; //蚂蚁走的路径
    double m_dbPathLength; //蚂蚁走过的路径长度
    int m_nCurCityNo; //当前所在城市编号
    int m_nMovedCityCount; //走过城市的数目
    vector<Path> path;
public:
    int ChooseNextCity(vector<City> &citytemp,int flag,double Phrm[n_city][n_city],double Distance[n_city][n_city]); //选择下一个城市
    void Init(Truck&); //初始化
    void Init();
    void Move(vector<City> &citytemp,Truck &truck,double Phrm[n_city][n_city],double Distance[n_city][n_city]); //蚂蚁在城市间移动
    void Search(vector<City> &citytemp,Truck& truck,double Phrm[n_city][n_city],double Distance[n_city][n_city]); //搜索路径
    void CalPathLength(double Distance[n_city][n_city]); //计算蚂蚁走过的路径长度
    void Pathchange();
    CAnt& operator =(CAnt &B);
};


//等号友元重载
CAnt& CAnt::operator =(CAnt &B)
{
    x=B.x;
    y=B.y;
    x_start=B.x_start;
    y_start=B.y_start;
    capacity=B.capacity;
    maxcapacity=B.maxcapacity;
    truckid=B.truckid;
    for(int i=0;i<50;i++)
        m_nPath[i]=B.m_nPath[i];
    m_dbPathLength=B.m_dbPathLength;
    m_nCurCityNo=B.m_nCurCityNo;
    m_nMovedCityCount=B.m_nMovedCityCount;
    vector<Path>().swap(path);
    for(int i=0;i<B.path.size();i++)
        path.push_back(B.path[i]);
}

//构造函数
CAnt::CAnt(void)
{
}

//析构函数
CAnt::~CAnt(void)
{
}

//初始化函数，蚂蚁搜索前调用
void CAnt::Init(Truck& truck)
{
    x=truck.x;  //蚂蚁位置初始化为卡车的位置
    y=truck.y;
    x_start=x;
    y_start=y;
    capacity=0;
    truckid=truck.truckid;
    maxcapacity=truck.maxcapacity;
    memset(m_nPath,0,sizeof(m_nPath));
    m_nPath[0]=-1;


    //蚂蚁走过的路径长度设置为0
    m_dbPathLength=0.0;
    m_nCurCityNo=-1;
    m_nMovedCityCount=1;
    vector<Path>().swap(path);
  ///  cout<<"CAnt::Init end ..."<<endl;

}

//选择下一个城市
//返回值 为城市编号
int CAnt::ChooseNextCity(vector<City> &citytemp,int flag,double Phrm[n_city][n_city],double Distance[n_city][n_city])
{
    c_choosecity++;

    int nSelectedCity=-1; //返回结果，先暂时把其设置为-1
    int n_citytemp=citytemp.size();

    //==============================================================================
    //计算当前位置到供应城市的可能性

    double dbTotal=0.0;
    double prob[n_citytemp]; //保存各个城市被选中的概率

    for (int i=0;i<n_citytemp;i++)
    {


        if(flag==1)
        {

            if (citytemp[i].num>0) //供应地
            {
                prob[i]=pow(Phrm[m_nCurCityNo][i],ALPHA)*pow(1.0/Distance[m_nCurCityNo][i],BETA); //该城市和当前城市间的信息素
              ///  prob[i]=Phrm[m_nCurCityNo][i]/Distance[m_nCurCityNo][i];
                dbTotal=dbTotal+prob[i]; //累加信息素，得到总和
            }
            else //如果不是供应地
                prob[i]=0.0;

        }

        if(flag==-1)
        {

            if (citytemp[i].num<0) //需求地
            {
                prob[i]=pow(Phrm[m_nCurCityNo][i],ALPHA)*pow(1.0/Distance[m_nCurCityNo][i],BETA); //该城市和当前城市间的信息素
              ///  prob[i]=Phrm[m_nCurCityNo][i]/Distance[m_nCurCityNo][i];
                dbTotal=dbTotal+prob[i]; //累加信息素，得到总和
            }
            else //如果不是需求地
                prob[i]=0.0;

        }


    }

    //==============================================================================
    //进行轮盘选择
    double dbTemp=0.0;
    if (dbTotal > 0.0) //总的可能性值大于0
    {
        dbTemp=rnd(0.0,dbTotal); //取一个随机数
        for (int i=0;i<n_citytemp;i++)
        {

            dbTemp=dbTemp-prob[i]; //这个操作相当于转动轮盘
            if (dbTemp < 0.0) //轮盘停止转动，记下城市编号，直接跳出循
            {
                nSelectedCity=i;
                break;
            }
        }
    }
    //==============================================================================
    //如果城市间的信息素非常小 ( 小到比double能够表示的最小的数字还要小 )
    //那么由于浮点运算的误差原因，上面计算的概率总和可能为0
    //会出现经过上述操作，没有城市被选择出来
    //出现这种情况，就把第一个没去过的城市作为返回结果

    if (nSelectedCity == -1)
    {
        c_chooseerror++;
        for (int i=0;i<n_citytemp;i++)
        {
            if (flag==1) //如果需要到供应地
            {

                if(citytemp[i].num>0)
                {
                    nSelectedCity=i;
                    break;
                }

            }

            if (flag==-1) //如果需要到供应地
            {

                if(citytemp[i].num<0)
                {
                    nSelectedCity=i;
                    break;
                }

            }

        }
    }


    //==============================================================================
    //返回结果，就是城市的编号
   /// cout<<"CAnt::ChooseNextCity end ..."<<endl;
    return nSelectedCity;
}


//蚂蚁在城市间移动
void CAnt::Move(vector<City> &citytemp,Truck &truck,double Phrm[n_city][n_city],double Distance[n_city][n_city])
{
    Path p;   //路径详细记录
    p.truckid=truck.truckid;
    //如果当前城市是-1，即蚂蚁处在初始位置时，将该详细路径的sorce记录为【 [x_start,y_start] 】的形式
    if(m_nCurCityNo==-1)
    {
        char temp1[10];
        char temp2[5];
        char temp3[5];

        itoa(x_start,temp2,10);
        int xlen=strlen(temp2);
        itoa(y_start,temp3,10);
        int ylen=strlen(temp3);

        temp1[0]='[';
        itoa(x_start,&temp1[1],10);
        temp1[xlen+1]=',';
        itoa(y_start,&temp1[xlen+2],10);
        temp1[xlen+2+ylen]=']';
        temp1[xlen+2+ylen+1]='\0';
        strcpy(p.source,temp1);
    }
    else strcpy(p.source,citytemp[m_nCurCityNo].name);

    int flag;
    if(capacity>0)flag=-1;
    else flag=1;
    m_nCurCityNo=ChooseNextCity(citytemp,flag,Phrm,Distance); //选择下一个城市
    m_nPath[m_nMovedCityCount]=m_nCurCityNo; //保存蚂蚁走的路径
    m_nMovedCityCount++;

    strcpy(p.target,citytemp[m_nCurCityNo].name);

    //物资装运
    if(flag==1)
    {
      //总需求量统计
        int totaldemand=0;
        for(int i=0;i<citytemp.size();i++)
        {
            if(citytemp[i].num<0)totaldemand+=citytemp[i].num;
        }
        totaldemand=-totaldemand;


        int num=citytemp[m_nCurCityNo].num;

        if(num<maxcapacity)
        {
            if(totaldemand>num)//总需求量大于此城市供应量，全装
                capacity=citytemp[m_nCurCityNo].num;
            else //总需求量小于该城市物资量，只需要装货 总需求量值
                capacity=totaldemand;
        }
        else //供应地物资大于或者等于最大运载量，此时将车装满，该地物资减少相应数量
        {
            if(totaldemand<maxcapacity) capacity=totaldemand;
            else  capacity=maxcapacity;
        }
        citytemp[m_nCurCityNo].num-=capacity;
        p.number=-capacity;
        p.nowload=capacity;



    }

    //物资卸货
    if(flag==-1)
    {
        int num=-citytemp[m_nCurCityNo].num;
        if(num<capacity)  //需求量少于该车运载量，从车上卸货相应需求量即可
        {
            capacity-=num;
            citytemp[m_nCurCityNo].num=0;
            p.number=num;
            p.nowload=capacity;
        }
        else  //需求量大于或者等于该车运载量，将车上所有货物卸下，该地需求量减少该卸货量
        {
            citytemp[m_nCurCityNo].num+=capacity;
            p.number=capacity;
            capacity=0;
            p.nowload=0;
        }

    }
    //将该次move的详细信息压入path<vector>
    path.push_back(p);
  ///  cout<<"CAnt::Move end  , m_nMovedCityCount="<<m_nMovedCityCount<<endl;
}



//蚂蚁进行搜索一次
void CAnt::Search(vector <City> &citytemp,Truck &truck,double Phrm[n_city][n_city],double Distance[n_city][n_city])
{
    Init(truck); //蚂蚁搜索前，先初始化
    //如果存在需求地还有需求，就继续移动
    while (1)
    {
        bool flag=false; //是否存在需求地
        for(int i=0;i<citytemp.size();i++)
        {

            if(citytemp[i].num<0)
                {
                    flag=true;
                    break;
                }
        }

        if(flag==true)
                Move(citytemp,truck,Phrm,Distance);
        else break;
    }
    //完成搜索后计算走过的路径长度
    CalPathLength(Distance);
  ///  cout<<"CAnt::Search end ...##########################"<<endl;
}


//计算蚂蚁走过的路径长度
void CAnt::CalPathLength(double Distance[n_city][n_city])
{

    m_dbPathLength=0.0; //先把路径长度置0
    int m=0;
    int n=0;
    for (int i=2;i<m_nMovedCityCount;i++)
    {
        m=m_nPath[i];
        n=m_nPath[i-1];
        m_dbPathLength+=Distance[m][n];
    }
    //加入出发点到第一个城市的距离计算
    double a=(x_start-city[m_nPath[1]].x)*(x_start-city[m_nPath[1]].x)+(y_start-city[m_nPath[1]].y)*(y_start-city[m_nPath[1]].y);
    a=pow(a,0.5);
    m_dbPathLength=m_dbPathLength+a;
///cout<<"CAnt::CalPathLenth end ... , m_dbPathLenth="<<m_dbPathLength<<endl;
}

void CAnt::Pathchange()
{


    Path p; //最终路径：从末次目的地到null
    p.truckid=truckid;
    strcpy(p.source,path[path.size()-1].target);
    strcpy(p.target,"null");
    p.number=path[path.size()-1].number;
    p.nowload=path[path.size()-1].nowload;
    path.push_back(p);
    //将number和nowload的含义改变
    //原本number表示对target城市num的该变量，nowload表示在target改变之后的载货量
    //将数组中前次Move路径中的number和nowload赋值给后一次路径中的number和nowload
    //含义变为：number:对sorce城市num的该变量。 nowload:load after source change
    for(int i=path.size()-2;i>=0;i--)
    {
        path[i+1].number=path[i].number;
        path[i+1].nowload=path[i].nowload;
    }
    path[0].number=0;
    path[0].nowload=0;
    for(int i=0;i<path.size();i++)
        path[i].number=-path[i].number;

}



//物资调度类
class CDistribution
{
public:
    CDistribution(void);
    ~CDistribution(void);

public:
    Truck truck;
    vector<City> dcity;
    CAnt m_cAntAry[n_ant]; //蚂蚁数组
    CAnt m_cBestAnt; //定义一个蚂蚁变量，用来保存搜索过程中的最优结果
                                        //该蚂蚁不参与搜索，只是用来保存最优结果

    double Phrm[n_city][n_city]; //两两城市间信息素，就是环境信息素
    double Distance[n_city][n_city]; //两两城市间距离


public:

    //初始化数据
    void InitData();

    //开始搜索
    void Search(Truck&);

    //更新环境信息素
    void UpdatePhrm();


};


//构造函数
CDistribution::CDistribution(void)
{
}

CDistribution::~CDistribution(void)
{
}


//初始化数据
void CDistribution::InitData()
{
    vector<Path>().swap(m_cBestAnt.path);
    m_cBestAnt.m_dbPathLength=DB_MAX;
    truck.Init();

    int dcitynum=dcity.size();
    //计算两两城市间距离
    double dbTemp=0.0;
    for (int i=0;i<dcitynum;i++)
    {
        for (int j=0;j<dcitynum;j++)
        {
            dbTemp=(dcity[i].x-dcity[j].x)*(dcity[i].x-dcity[j].x)+(dcity[i].y-dcity[j].y)*(dcity[i].y-dcity[j].y);
            dbTemp=pow(dbTemp,0.5);
      ///      Distance[i][j]=ROUND(dbTemp);
            Distance[i][j]=dbTemp;
        }
    }

    //初始化环境信息素，先把城市间的信息素设置成一样
    //这里设置成InitPhrm，设置成多少对结果影响不是太大，对算法收敛速度有些影响
    for (int i=0;i<dcitynum;i++)
    {
        for (int j=0;j<dcitynum;j++)
        {
            Phrm[i][j]=InitPhrm;
        }
    }

}


//更新环境信息素
void CDistribution::UpdatePhrm()
{
    //临时数组，保存各只蚂蚁在两两城市间新留下的信息素
    double dbTempAry[dcity.size()][dcity.size()];
    memset(dbTempAry,0,sizeof(dbTempAry)); //先全部设置为0

    //计算新增加的信息素,保存到临时数组里
    int m=0;
    int n=0;
    for (int i=0;i<n_ant;i++) //计算每只蚂蚁留下的信息素
    {
            for (int j=1;j<m_cAntAry[i].m_nMovedCityCount;j++)
            {
                m=m_cAntAry[i].m_nPath[j];
                n=m_cAntAry[i].m_nPath[j-1];
                dbTempAry[n][m]+=MaxPhrm/m_cAntAry[i].m_dbPathLength;
                dbTempAry[m][n]=dbTempAry[n][m];
            }

    }

    //==================================================================
    //更新环境信息素
    for (int i=0;i<dcity.size();i++)
    {
        for (int j=0;j<dcity.size();j++)
        {
            Phrm[i][j]=Phrm[i][j]*ROU+dbTempAry[i][j]; //最新的环境信息素 = 留存的信息素 + 新留下的信息素
        }
    }

}


void CDistribution::Search(Truck& truck)
{

    //在迭代次数内进行循环
    int dcitysize=dcity.size();
    for (int i=0;i<n_iterator;i++)
    {
        //每只蚂蚁搜索一遍
        for (int j=0;j<n_ant;j++)
        {
            vector<City> citytemp;
            for(int q=0;q<dcitysize;q++)
                citytemp.push_back(dcity[q]);

            m_cAntAry[j].Search(citytemp,truck,Phrm,Distance);
        }

        //保存最佳结果
        for (int j=0;j<n_ant;j++)
        {
            if (m_cAntAry[j].m_dbPathLength < m_cBestAnt.m_dbPathLength)
            {
                m_cBestAnt=m_cAntAry[j];
            }
        }


        //更新环境信息素
        UpdatePhrm();

    }

///  cout<<"Distr::Search - m_cBestAnt.path.size()="<<m_cBestAnt.path.size()<<endl;
///  system("pause");

    for(int i=0;i<m_cBestAnt.m_nMovedCityCount;i++)
    {
        truck.truckpath[i]=m_cBestAnt.m_nPath[i];
    }
    truck.n_pathnum=m_cBestAnt.m_nMovedCityCount;
    truck.pathlen=m_cBestAnt.m_dbPathLength;

}

void ReadInJson(CDistribution * Distr)
{
    Json::Reader reader;
    Json::Value root;

    ifstream is;
    is.open(INPUTJSON,ios::binary);
    if(reader.parse(is,root))
    {
        //城市信息读入
        n_source=root["sourcelist"].size();
        n_target=root["targetlist"].size();
        citynum=n_source+n_target;
        City c[citynum];
        for(int i=0;i<n_source;i++)
        {
            //组合出城市name
            char temp[10];//用来组合出城市名字
            int num=i+1;  //城市名字的序号部分
            temp[0]='m';
            itoa(num,&temp[1],10);
            strcpy(c[i].name,temp);

            c[i].x=root["sourcelist"][i]["x"].asInt();
            c[i].y=root["sourcelist"][i]["y"].asInt();
            c[i].num=root["sourcelist"][i]["num"].asInt();
        }
        for(int i=n_source;i<citynum;i++)
        {
             //组合出城市name
            char temp[10];//用来组合出城市名字
            int num=i-n_source+1;  //城市名字的序号部分
            temp[0]='n';
            itoa(num,&temp[1],10);
            strcpy(c[i].name,temp);

            c[i].x=root["targetlist"][i-n_source]["x"].asInt();
            c[i].y=root["targetlist"][i-n_source]["y"].asInt();
            c[i].num=-root["targetlist"][i-n_source]["num"].asInt();//需求地num为负数
        }

        for(int i=0;i<citynum;i++)
            city.push_back(c[i]);
        cout<<"从JSON读入的城市数据如下："<<endl;
        cout<<"source_num = "<<n_source<<"  target_num = "<<n_target<<endl<<endl;
        for(int i=0;i<citynum;i++)
            cout<<city[i];

        //JSON读入卡车数量，卡车数据
        DistrSize=root["trucklist"].size();
        for(int i=0;i<DistrSize;i++)
        {
            Distr[i].truck.truckid=i+1;
            Distr[i].truck.capacity=0;
            Distr[i].truck.x=root["trucklist"][i]["x"].asInt();
            Distr[i].truck.y=root["trucklist"][i]["y"].asInt();
            Distr[i].truck.maxcapacity=root["trucklist"][i]["capacity"].asInt();
        }

        cout<<"从JSON读入的卡车数据如下："<<endl;
        cout<<"DistrSize(truck_num)= "<<DistrSize<<endl;
        for(int i=0;i<DistrSize;i++)
            cout<<Distr[i].truck;
    }

}



//生成随机分组，并统计各分组的城市数量
void CreatGroup( int citygroup[][n_city],int citygroupnum[])
{

    for(int i=0;i<n_source;i++)
        city[i].group=-1;
    for(int i=n_source;i<citynum;i++)
        city[i].group=rand()%DistrSize;

        int pointer[DistrSize];
        memset(pointer,0,sizeof(pointer));
        //统计各城市的分组情况
        for(int i=0;i<citynum;i++)
        {

            if(city[i].group==-1)
            {
                for(int j=0;j<DistrSize;j++)
                {
                    citygroup[j][ pointer[j] ]=i;
                    pointer[j]++;
                }
            }
            else
            {
                int g=city[i].group;
                citygroup[g][ pointer[g] ]=i;
                pointer[g]++;
            }

        }

        for(int i=0;i<DistrSize;i++)
            citygroup[i][ pointer [i] ]=-1;

    for(int i=0;i<DistrSize;i++)
    {
        for(int j=0;j<n_city;j++)
            if(citygroup[i][j]==-1)
            {
                citygroupnum[i]=j;
                break;
            }
    }
/*
    //输出需求地分组信息
    for(int i=0;i<DistrSize;i++)
        cout<<"citygroupnum = "<<citygroupnum[i]<<endl;
    for(int i=0;i<DistrSize;i++)
    {
        for(int j=0;j<pointer[i];j++)
            cout<<citygroup[i][j]<<" ";
        cout<<endl;
    }
*/

}

void CreatRandNo(int na_RandNo[])
{
    for(int i=0;i<DistrSize;i++)
    {
        na_RandNo[i]=rand()%DistrSize;
        bool flag=true;
        while(flag)
        {
            flag=false;
            for(int j=0;j<i;j++)
            {
                if(na_RandNo[i]==na_RandNo[j])
                {
                    na_RandNo[i]=rand()%DistrSize;
                    flag=true;
                }
            }

        }//end while()

    }
}

bool JudgeNoDemander(int citygroupnum[],int n_supportnum)
{
    //判断是否存在没有需求地的分组
    for(int i=0;i<DistrSize;i++)
    {
        if(citygroupnum[i]<n_supportnum+1)
            return true;
    }
    return false;
}

bool JudgeRandNo(int na_RandNo[],int **na_PastRandNo,int* n_PastRandNoNum)
{

            bool flag=false;//默认生成的随机序列未被使用过
            //检查生成的随机序列是否被使用过
            if( (*n_PastRandNoNum) ==0)flag=false;
            else
            for(int i=0;i< (*n_PastRandNoNum) ;i++)
            {
                bool f=true;//被比较的两个序列一模一样
                for(int j=0;j<DistrSize;j++)
                {
                    if(na_RandNo[j]!= *((int*)na_PastRandNo+i*DistrSize+j) )
                    {
                        f=false;//出现不相同项时，直接跳到下一个序列检查
                        break;
                    }
                }
                if(f==true)
                {
                    flag=true;
                    break;
                }
            }

            if(flag==true)return true;//该序列已经被使用过，直接进行下一次的迭代随机序列

            else//该序列没有被使用过，记录该序列，并且 总序列的数量+1
            {
                for(int i=0;i<DistrSize;i++)
                {
                    *((int*)na_PastRandNo+(*n_PastRandNoNum)*DistrSize+i)=na_RandNo[i];
                //    na_PastRandNo[*n_PastRandNoNum][i]=na_RandNo[i];
                }
                (*n_PastRandNoNum)++;
                return false;
            }

}

void UpdateCityModel(vector<City>& citytmp,CDistribution & Distr)
{
            //城市模型更新
           if(Distr.truck.n_pathnum==1)
            {
                    cout<<"Distr.truck.n_pathnum==1,continue"<<endl;
  ///                  system("pause");
                    return;
            }
            /*
            cout<<"city model update begin..."<<endl;
            cout<<"citytmp.size()="<<citytmp.size()<<endl;
            */
            for(int j=0;j<citytmp.size();j++)
            {
               /// cout<<"j="<<j<<endl;

                for(int k=0;k<Distr.truck.n_pathnum;k++)
                {
                    if(strcmp(Distr.m_cBestAnt.path[k].target,citytmp[ j ].name)==0)
                        citytmp[ j ].num=citytmp[j].num+Distr.m_cBestAnt.path[k].number;
                }

            }//城市模型更新end
            /*
            cout<<"--------------------------"<<endl;
            cout<<"cities model update has been ended"<<endl;
            for(int i=0;i<citytmp.size();i++)
                cout<<citytmp[i];
            cout<<"-------------------------"<<endl;
            */
}


void ChangeDcity(CDistribution Distr[],int bestcitygroup[][n_city])
{
//根据bestcitygroup的记录给dcity赋值
    for(int i=0;i<DistrSize;i++)
    {
        vector<City>().swap(Distr[i].dcity);
        for(int j=0;j<n_city;j++)
        {
            int b=bestcitygroup[i][j];
            if(b==-1)break;
            else
            {
                Distr[i].dcity.push_back(city[b]);
            }
        }
    }

}


void STDPrint(CDistribution Distr[],int bestcitygroup[][n_city])//屏幕输出
{//输出结果至显示器
    cout<<endl<<"STDPrint start..."<<endl;
 //输出分组信息
     cout<<"bestcitygroup :"<<endl;
    for(int i=0;i<DistrSize;i++)
    {
        cout<<"Distr["<<i<<"] : ";
        for(int j=0;j<n_city;j++)
        {

            if(bestcitygroup[i][j]!=-1)
                cout<<bestcitygroup[i][j]<<" ";
            else break;
        }
        cout<<endl;
    }
/*
    cout<<"Print init data"<<endl;
    for(int i=0;i<DistrSize;i++)
    {
        cout<<"path of Distr"<<i<<" : "<<endl;
        for(int j=0;j<Distr[i].truck.n_pathnum;j++)
        {
            cout<<Distr[i].m_cBestAnt.m_nPath[j]<<" ";
        }
        cout<<endl;
    }
    printf("\nThe best path is :\n");
*/

    for(int i=0;i<DistrSize;i++)//一次输出每个Distrbution中卡车的路线信息
    {

        cout<<"truck "<<i+1<<" : ";
        for(int j=0;j<Distr[i].truck.n_pathnum;j++)
        {
            if(Distr[i].m_cBestAnt.m_nPath[j]==-1)
                cout<<"["<<Distr[i].m_cBestAnt.x_start<<","<<Distr[i].m_cBestAnt.y_start<<"]";
            else
            cout<<",\""<<Distr[i].dcity[ Distr[i].m_cBestAnt.m_nPath[j] ].name<<"\"";
        }
        cout<<endl;
    }
    cout<<endl;
    double mxlen=0;
    double totallen=0;
    for(int i=0;i<DistrSize;i++)
    {
        cout<<"truck"<<i+1<<" 's pathlen ="<<Distr[i].truck.pathlen<<endl;
        totallen=totallen+Distr[i].truck.pathlen;
        if(Distr[i].truck.pathlen>mxlen)
            mxlen=Distr[i].truck.pathlen;
    }
    cout<<"The total length of all the trucks is 【"<<totallen<<"】"<<endl;
    cout<<"The least time to finish all the distribution works is 【"<<mxlen<<"/speed】"<<endl;

    cout<<endl<<"STDPrint end..."<<endl;
}

void FilePrint(CDistribution Distr[], double Trun)//文件输出
{
//输出结果json至文件
    cout<<endl<<"FilePrint start..."<<endl;


    for(int i=0;i<DistrSize;i++)//每个子调度最优蚂蚁的详细路径变为输出格式，并且压入卡车内
    {
        cout<<"i="<<i<<endl;
        cout<<"Distr[i].m_cBestAnt.path.size()="<<Distr[i].m_cBestAnt.path.size()<<endl;
        Distr[i].m_cBestAnt.Pathchange();
        cout<<"Pathchange  ok ..."<<endl;
        for(int j=0;j<Distr[i].m_cBestAnt.path.size();j++)
            Distr[i].truck.path.push_back(Distr[i].m_cBestAnt.path[j]);
    }

    cout<<"all path change ok ..."<<endl;


    //详细路径输出
    ifstream temp;
    temp.open("home/cyq/django/mysite/vrp/static/temp.txt");
    char buf[30];
    temp.getline(buf,30);
    string name=buf;
    cout<<"name: "<<name<<endl;
    temp.close();

    string nnn="home/cyq/django/mysite/";
    string fff=nnn+name;
    char filepath[100];
    strcpy(filepath,fff.c_str());

    ofstream f;
    f.open(filepath,ios::binary|ios::app );
    out<<"{"<<endl;
    out<<"\"record\":"<<endl;;
    out<<"["<<endl;

    bool flag=false;//不输出头逗号

    for(int i=0;i<DistrSize;i++)
    {

        for(int j=0;j<Distr[i].truck.path.size();j++)
        {
            if(flag)
            {
                out<<","<<endl;
            }
            flag=true;
            out<<Distr[i].truck.path[j];
        }

    }
    out<<endl<<"]"<<endl;

    //总路径输出
    out<<","<<endl;
    out<<"\"pathlist\":"<<endl;
    out<<"["<<endl;

    //卡车总路径结构
    flag=false; //不输出头逗号
    for(int i=0;i<DistrSize;i++)
    {
        if(flag)
        {
            out<<","<<endl;
        }
        flag=true;
        out<<"{"<<endl;
        out<<"\"truckid\":"<<Distr[i].truck.truckid<<","<<endl;
        out<<"\"path\":[";
        for(int j=0;j<Distr[i].truck.n_pathnum;j++)
        {
            if(Distr[i].truck.truckpath[j]==-1)
                out<<"["<<Distr[i].truck.x<<","<<Distr[i].truck.y<<"]";
            else
            out<<",\""<<Distr[i].dcity[ Distr[i].truck.truckpath[j] ].name<<"\"";
        }
        out<<"]"<<endl;
        out<<"}"<<endl;

    }




    out<<"]"<<endl;
    out<<","<<endl;
    out<<"\"time\":"<<Trun<<endl;

    out<<"}"<<endl;


    cout<<"FilePrint to OutJSON.txt end..."<<endl;
}

int main()
{
//记录开始运行的时间
    int Tstart=clock();
//用当前时间点初始化随机种子，防止每次运行的结果都相同
    srand(time(NULL));

//【使用json读入来完成所有初始化工作】
    CDistribution Distr[12];
    ReadInJson(Distr);
/*
    int a=n_source;
    int b=n_target;
    int c=DistrSize;
    n_iterator=a*b*c;
    n_iter_group=n_iterator*2;
    n_iter_randNo=pow(2,c+2)-10;
    cout<<"n_iterator="<<n_iterator<<endl;
    cout<<"n_iter_group="<<n_iter_group<<endl;
    cout<<"n_iter_randNo="<<n_iter_randNo<<endl;
*/

//citygroup[][] and citygroupnum[]
    int citygroupnum[DistrSize];
    int bestcitygroup[DistrSize][n_city];
    memset(citygroupnum,0,sizeof(citygroupnum));

//新建结果蚂蚁和结果卡车储存最终结果,并且shortestPathLen记录最优路径长度，作为比较因子看是否需要记录此次数据
    CAnt resultAnt[DistrSize];
    Truck resultTruck[DistrSize];
    double shortestPathLen=DB_MAX;

//循环执行 分组  调度  任务，以取最优化分组
    for(int it=0;it<n_iter_group;it++)
    {

        int citygroup[DistrSize][n_city];
    //随机分组
        CreatGroup(citygroup,citygroupnum);
    //判断是否存在  没有需求地 的分组
        if( JudgeNoDemander(citygroupnum,n_source) )continue;

///system("pause");


//复制城市模型，开始随机子任务序列，并且循环iter次求取最优路径
        int na_PastRandNo[n_iter_randNo][DistrSize];//存储已经使用过的随机序列
        int n_PastRandNoNum=0;
//后面再生成随机序列时，若新生成的随机序列已经使用过，
//则重新生成，直到生成一条没有使用过的序列为止
        bool flag_updata=false;//此分组是否可以更新最优解
        for(int iter=0;iter<n_iter_randNo;iter++)
        {

            //建立子调度任务的随机序列
            int na_RandNo[DistrSize];
            CreatRandNo(na_RandNo);


//&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&
          if( JudgeRandNo(na_RandNo,(int**)na_PastRandNo,&n_PastRandNoNum) )continue;

//&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&
/*
            //输出随机序列
            cout<<endl<<"na_RandNo is :"<<endl;
            for(int i=0;i<DistrSize;i++)
            {
                cout<<na_RandNo[i]<<" ";
            }
            cout<<endl;
*/
            //复制城市模型
            vector<City> citytmp;
            for(int i=0;i<city.size();i++)
                citytmp.push_back(city[i]);

/*
            //输出城市副本模型信息
            cout<<"--------citytmp----------"<<endl;
            for(int i=0;i<citytmp.size();i++)
                cout<<citytmp[i];
           cout<<"-------------------"<<endl;

*/


            bool flag_break=false;
            //按照随机序列依次执行子调度任务
            for(int i=0;i<DistrSize;i++)
            {

                vector<City>().swap(Distr[ na_RandNo[i] ].dcity);
                //子调度任务中城市分配
                for(int j=0;j<citygroupnum[ na_RandNo[i] ];j++)
                    Distr[na_RandNo[i]].dcity.push_back(citytmp[ citygroup[ na_RandNo[i]  ][j] ]);
                //输出子任务
/*
                cout<<"sub-task "<<na_RandNo[i]<<" dcities:"<<endl;
                for(int j=0;j<Distr[ na_RandNo[i] ].dcity.size();j++)
                {
                    cout<<Distr[ na_RandNo[i] ].dcity[j];
                }
///system("pause");
*/
                //初始化
                Distr[ na_RandNo[i] ].InitData();
  ///              cout<<endl<<"Distr["<<na_RandNo[i]<<"].InitData() has been ended..."<<endl;

                int totalsupply=0;
                int totaldemand=0;
                for(int j=0;j<Distr[ na_RandNo[i] ].dcity.size();j++)
                {
                    if(Distr[ na_RandNo[i] ].dcity[j].num>0)totalsupply+=Distr[ na_RandNo[i] ].dcity[j].num;
                    if(Distr[ na_RandNo[i] ].dcity[j].num<0)totaldemand+=Distr[ na_RandNo[i] ].dcity[j].num;
                }
                totaldemand=-totaldemand;
                if(totaldemand>totalsupply)
                {
                    flag_break=true;
                    break;
                }
  ///              cout<<"dcity's totalsuply="<<totalsupply<<endl;
  ///              cout<<"dcity's totaldemand="<<totaldemand<<endl;

                //搜索
                Distr[ na_RandNo[i] ].Search(Distr[ na_RandNo[i] ].truck);
  ///              cout<<endl<<"Distr["<<na_RandNo[i]<<"].Search() has been ended..."<<endl;

                //更新城市模型，并输出更新后的城市信息
                UpdateCityModel(citytmp,Distr[ na_RandNo[i] ]);

///system("pause");
            }//按照序列执行子任务end
            if(flag_break==true)continue;
            bool flag_nofinish=false;
            for(int i=0;i<citytmp.size();i++)
                if(citytmp[i].num<0)
                {
                    flag_nofinish=true;
                    break;
                }
            if(flag_nofinish==true)
            {
                c_nofinish++;
                continue;
            }

            //计算本次的最短路径，并判断是否需要更新结果
            double shortPathlen=0;
            for(int i=0;i<DistrSize;i++)
            {
                if(Distr[i].truck.pathlen>shortPathlen)
                    shortPathlen=Distr[i].truck.pathlen;
            }
 ///           cout<<endl<<"shortPathLen = "<<shortPathlen<<endl;
///system("pause");
            if( (flag_updata==false) &&( shortPathlen>shortestPathLen*2) )//本次分组的本次子任务序列的最短完成时间
            {
                c_skipgroup++;
                break;
            }
            if(shortPathlen<shortestPathLen)//新的最优解，更新结果蚂蚁和卡车
            {
                flag_updata=true;
                c_update++;
                shortestPathLen=shortPathlen;
                for(int i=0;i<DistrSize;i++)
                {
                    resultAnt[i]=Distr[i].m_cBestAnt;
                    resultTruck[i]=Distr[i].truck;
  ///                  cout<<"Distr[i].m_cBestAnt.path.size()="<<Distr[i].m_cBestAnt.path.size()<<endl;
   ///                 cout<<"resultAnt's path.size()= "<<resultAnt[i].path.size()<<endl;
    ///                cout<<"resultTruck's path.size() = "<<resultTruck[i].path.size()<<endl;
///system("pause");
                    for(int j=0;j<n_city;j++)
                    bestcitygroup[i][j]=citygroup[i][j];
                }
  ///              cout<<"The result has been update<<<<"<<endl;
 ///system("pause");
            }
/*
            for(int i=0;i<DistrSize;i++)
            {
                cout<<"Distr"<<i<<".m_cBestAnt.pathlengh = "<<Distr[i].m_cBestAnt.m_dbPathLength<<endl;
            }
/// system("pause");
*/

        }//总求优路径end for(int it=0;it<n_iter_randNo;it++)

    }//需求地分配循环 for(int it=0;it<n_iter_group;it++)


   //根据bestcitygroup的记录给dcity赋值
    ChangeDcity(Distr,bestcitygroup);


//将结果蚂蚁和卡车赋值给Distribution里的最优蚂蚁和卡车，作为最终结果执行输出
    for(int i=0;i<DistrSize;i++)
    {
        Distr[i].m_cBestAnt=resultAnt[i];
        Distr[i].truck=resultTruck[i];
    }

//时间计算
    int Tend=clock();
    double Trun=Tend-Tstart;
    Trun=Trun/=1000;

//////*********计算过程完毕，开始输出*********************////////
    cout<<endl<<"The Running time is "<<Trun<<" s"<<endl;

//输出结果json至文件
    FilePrint(Distr,Trun);
//输出结果至显示器
    STDPrint(Distr,bestcitygroup);
    cout<<"c_skipgroup="<<c_skipgroup<<endl;
    cout<<"c_update="<<c_update<<endl;
    cout<<"c_nofinish="<<c_nofinish<<endl;
    cout<<"choose error index = "<<c_chooseerror*1.0/c_choosecity<<endl;

    return 0;
}


