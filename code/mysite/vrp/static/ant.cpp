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
const double ALPHA=2.0; //�������ӣ���Ϣ�ص���Ҫ�̶�
const double BETA=1.0;   //�������ӣ����м�������Ҫ�̶�
const double ROU=0.5; //��Ϣ�ز�������

const int n_ant=3; //��������
int n_iterator=100; //���ϵ�������
int n_iter_group=300;//�ظ����������
int n_iter_randNo=20;//�����������������
const int n_city=50; //��������

const double MaxPhrm=1000.0; //�ܵ���Ϣ��
const double InitPhrm=0.0;  //��ʼ��Ϣ��
const double DB_MAX=10e9; //һ����־����10��9�η�

int DistrSize;
int citynum;
int n_source;
int n_target;

class City;  //��ĳ�ǰ����

vector<City> city;  //����ȫ�ֱ���


//����ָ����Χ�ڵ��������
int rnd(int nLow,int nUpper)
{
    return nLow+(nUpper-nLow)*rand()/(RAND_MAX+1);
}

//����ָ����Χ�ڵ����������
double rnd(double dbLow,double dbUpper)
{
    double dbTemp=rand()/((double)RAND_MAX+1.0);
    return dbLow+dbTemp*(dbUpper-dbLow);
}

//���ظ�������������ȡ����ĸ�����
double ROUND(double dbA)
{
    return (double)((int)(dbA+0.5));
}


class City
{
public:
    int x;    //x,y,Ϊ�˳��е�λ������
    int y;
    int num;//��Ϊ��Ӧ�أ���Ϊ�����
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

//����·���࣬��ϸ��¼����·��
class Path
{
public:
    int truckid;
    char source[10];
    char target[10];
    int number;  //Ŀ�ĵ�num�ı���
    int nowload; //Ŀ�ĵغ���ػ���
    friend void operator <<(ostream &out,Path &p)  //JSON��ʽ���
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
    int x;    //x,y,Ϊ�˿����ĳ�ʼλ������
    int y;
    int maxcapacity;//����ػ���
    int capacity;//��ǰ�ػ���
    int truckid;
    int truckpath[50];
    int n_pathnum;
    double pathlen;
    vector<Path> path;
    Truck& operator = (Truck & B );
    friend ostream &operator <<(ostream& out, Truck truck );
    void Init();
};
//��ʼ������
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
//Truck��ĵȺ�����
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
    int x; //���ϵ�����
    int y;
    int x_start;//���ϳ�ʼλ��
    int y_start;
    int capacity;//���ϵĵ�ǰ����
    int maxcapacity;//���������
    int truckid;
    CAnt(void);
    ~CAnt(void);

    int m_nPath[50]; //�����ߵ�·��
    double m_dbPathLength; //�����߹���·������
    int m_nCurCityNo; //��ǰ���ڳ��б��
    int m_nMovedCityCount; //�߹����е���Ŀ
    vector<Path> path;
public:
    int ChooseNextCity(vector<City> &citytemp,int flag,double Phrm[n_city][n_city],double Distance[n_city][n_city]); //ѡ����һ������
    void Init(Truck&); //��ʼ��
    void Init();
    void Move(vector<City> &citytemp,Truck &truck,double Phrm[n_city][n_city],double Distance[n_city][n_city]); //�����ڳ��м��ƶ�
    void Search(vector<City> &citytemp,Truck& truck,double Phrm[n_city][n_city],double Distance[n_city][n_city]); //����·��
    void CalPathLength(double Distance[n_city][n_city]); //���������߹���·������
    void Pathchange();
    CAnt& operator =(CAnt &B);
};


//�Ⱥ���Ԫ����
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

//���캯��
CAnt::CAnt(void)
{
}

//��������
CAnt::~CAnt(void)
{
}

//��ʼ����������������ǰ����
void CAnt::Init(Truck& truck)
{
    x=truck.x;  //����λ�ó�ʼ��Ϊ������λ��
    y=truck.y;
    x_start=x;
    y_start=y;
    capacity=0;
    truckid=truck.truckid;
    maxcapacity=truck.maxcapacity;
    memset(m_nPath,0,sizeof(m_nPath));
    m_nPath[0]=-1;


    //�����߹���·����������Ϊ0
    m_dbPathLength=0.0;
    m_nCurCityNo=-1;
    m_nMovedCityCount=1;
    vector<Path>().swap(path);
  ///  cout<<"CAnt::Init end ..."<<endl;

}

//ѡ����һ������
//����ֵ Ϊ���б��
int CAnt::ChooseNextCity(vector<City> &citytemp,int flag,double Phrm[n_city][n_city],double Distance[n_city][n_city])
{
    c_choosecity++;

    int nSelectedCity=-1; //���ؽ��������ʱ��������Ϊ-1
    int n_citytemp=citytemp.size();

    //==============================================================================
    //���㵱ǰλ�õ���Ӧ���еĿ�����

    double dbTotal=0.0;
    double prob[n_citytemp]; //����������б�ѡ�еĸ���

    for (int i=0;i<n_citytemp;i++)
    {


        if(flag==1)
        {

            if (citytemp[i].num>0) //��Ӧ��
            {
                prob[i]=pow(Phrm[m_nCurCityNo][i],ALPHA)*pow(1.0/Distance[m_nCurCityNo][i],BETA); //�ó��к͵�ǰ���м����Ϣ��
              ///  prob[i]=Phrm[m_nCurCityNo][i]/Distance[m_nCurCityNo][i];
                dbTotal=dbTotal+prob[i]; //�ۼ���Ϣ�أ��õ��ܺ�
            }
            else //������ǹ�Ӧ��
                prob[i]=0.0;

        }

        if(flag==-1)
        {

            if (citytemp[i].num<0) //�����
            {
                prob[i]=pow(Phrm[m_nCurCityNo][i],ALPHA)*pow(1.0/Distance[m_nCurCityNo][i],BETA); //�ó��к͵�ǰ���м����Ϣ��
              ///  prob[i]=Phrm[m_nCurCityNo][i]/Distance[m_nCurCityNo][i];
                dbTotal=dbTotal+prob[i]; //�ۼ���Ϣ�أ��õ��ܺ�
            }
            else //������������
                prob[i]=0.0;

        }


    }

    //==============================================================================
    //��������ѡ��
    double dbTemp=0.0;
    if (dbTotal > 0.0) //�ܵĿ�����ֵ����0
    {
        dbTemp=rnd(0.0,dbTotal); //ȡһ�������
        for (int i=0;i<n_citytemp;i++)
        {

            dbTemp=dbTemp-prob[i]; //��������൱��ת������
            if (dbTemp < 0.0) //����ֹͣת�������³��б�ţ�ֱ������ѭ
            {
                nSelectedCity=i;
                break;
            }
        }
    }
    //==============================================================================
    //������м����Ϣ�طǳ�С ( С����double�ܹ���ʾ����С�����ֻ�ҪС )
    //��ô���ڸ�����������ԭ���������ĸ����ܺͿ���Ϊ0
    //����־�������������û�г��б�ѡ�����
    //��������������Ͱѵ�һ��ûȥ���ĳ�����Ϊ���ؽ��

    if (nSelectedCity == -1)
    {
        c_chooseerror++;
        for (int i=0;i<n_citytemp;i++)
        {
            if (flag==1) //�����Ҫ����Ӧ��
            {

                if(citytemp[i].num>0)
                {
                    nSelectedCity=i;
                    break;
                }

            }

            if (flag==-1) //�����Ҫ����Ӧ��
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
    //���ؽ�������ǳ��еı��
   /// cout<<"CAnt::ChooseNextCity end ..."<<endl;
    return nSelectedCity;
}


//�����ڳ��м��ƶ�
void CAnt::Move(vector<City> &citytemp,Truck &truck,double Phrm[n_city][n_city],double Distance[n_city][n_city])
{
    Path p;   //·����ϸ��¼
    p.truckid=truck.truckid;
    //�����ǰ������-1�������ϴ��ڳ�ʼλ��ʱ��������ϸ·����sorce��¼Ϊ�� [x_start,y_start] ������ʽ
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
    m_nCurCityNo=ChooseNextCity(citytemp,flag,Phrm,Distance); //ѡ����һ������
    m_nPath[m_nMovedCityCount]=m_nCurCityNo; //���������ߵ�·��
    m_nMovedCityCount++;

    strcpy(p.target,citytemp[m_nCurCityNo].name);

    //����װ��
    if(flag==1)
    {
      //��������ͳ��
        int totaldemand=0;
        for(int i=0;i<citytemp.size();i++)
        {
            if(citytemp[i].num<0)totaldemand+=citytemp[i].num;
        }
        totaldemand=-totaldemand;


        int num=citytemp[m_nCurCityNo].num;

        if(num<maxcapacity)
        {
            if(totaldemand>num)//�����������ڴ˳��й�Ӧ����ȫװ
                capacity=citytemp[m_nCurCityNo].num;
            else //��������С�ڸó�����������ֻ��Ҫװ�� ��������ֵ
                capacity=totaldemand;
        }
        else //��Ӧ�����ʴ��ڻ��ߵ����������������ʱ����װ�����õ����ʼ�����Ӧ����
        {
            if(totaldemand<maxcapacity) capacity=totaldemand;
            else  capacity=maxcapacity;
        }
        citytemp[m_nCurCityNo].num-=capacity;
        p.number=-capacity;
        p.nowload=capacity;



    }

    //����ж��
    if(flag==-1)
    {
        int num=-citytemp[m_nCurCityNo].num;
        if(num<capacity)  //���������ڸó����������ӳ���ж����Ӧ����������
        {
            capacity-=num;
            citytemp[m_nCurCityNo].num=0;
            p.number=num;
            p.nowload=capacity;
        }
        else  //���������ڻ��ߵ��ڸó������������������л���ж�£��õ����������ٸ�ж����
        {
            citytemp[m_nCurCityNo].num+=capacity;
            p.number=capacity;
            capacity=0;
            p.nowload=0;
        }

    }
    //���ô�move����ϸ��Ϣѹ��path<vector>
    path.push_back(p);
  ///  cout<<"CAnt::Move end  , m_nMovedCityCount="<<m_nMovedCityCount<<endl;
}



//���Ͻ�������һ��
void CAnt::Search(vector <City> &citytemp,Truck &truck,double Phrm[n_city][n_city],double Distance[n_city][n_city])
{
    Init(truck); //��������ǰ���ȳ�ʼ��
    //�����������ػ������󣬾ͼ����ƶ�
    while (1)
    {
        bool flag=false; //�Ƿ���������
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
    //�������������߹���·������
    CalPathLength(Distance);
  ///  cout<<"CAnt::Search end ...##########################"<<endl;
}


//���������߹���·������
void CAnt::CalPathLength(double Distance[n_city][n_city])
{

    m_dbPathLength=0.0; //�Ȱ�·��������0
    int m=0;
    int n=0;
    for (int i=2;i<m_nMovedCityCount;i++)
    {
        m=m_nPath[i];
        n=m_nPath[i-1];
        m_dbPathLength+=Distance[m][n];
    }
    //��������㵽��һ�����еľ������
    double a=(x_start-city[m_nPath[1]].x)*(x_start-city[m_nPath[1]].x)+(y_start-city[m_nPath[1]].y)*(y_start-city[m_nPath[1]].y);
    a=pow(a,0.5);
    m_dbPathLength=m_dbPathLength+a;
///cout<<"CAnt::CalPathLenth end ... , m_dbPathLenth="<<m_dbPathLength<<endl;
}

void CAnt::Pathchange()
{


    Path p; //����·������ĩ��Ŀ�ĵص�null
    p.truckid=truckid;
    strcpy(p.source,path[path.size()-1].target);
    strcpy(p.target,"null");
    p.number=path[path.size()-1].number;
    p.nowload=path[path.size()-1].nowload;
    path.push_back(p);
    //��number��nowload�ĺ���ı�
    //ԭ��number��ʾ��target����num�ĸñ�����nowload��ʾ��target�ı�֮����ػ���
    //��������ǰ��Move·���е�number��nowload��ֵ����һ��·���е�number��nowload
    //�����Ϊ��number:��sorce����num�ĸñ����� nowload:load after source change
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



//���ʵ�����
class CDistribution
{
public:
    CDistribution(void);
    ~CDistribution(void);

public:
    Truck truck;
    vector<City> dcity;
    CAnt m_cAntAry[n_ant]; //��������
    CAnt m_cBestAnt; //����һ�����ϱ����������������������е����Ž��
                                        //�����ϲ�����������ֻ�������������Ž��

    double Phrm[n_city][n_city]; //�������м���Ϣ�أ����ǻ�����Ϣ��
    double Distance[n_city][n_city]; //�������м����


public:

    //��ʼ������
    void InitData();

    //��ʼ����
    void Search(Truck&);

    //���»�����Ϣ��
    void UpdatePhrm();


};


//���캯��
CDistribution::CDistribution(void)
{
}

CDistribution::~CDistribution(void)
{
}


//��ʼ������
void CDistribution::InitData()
{
    vector<Path>().swap(m_cBestAnt.path);
    m_cBestAnt.m_dbPathLength=DB_MAX;
    truck.Init();

    int dcitynum=dcity.size();
    //�����������м����
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

    //��ʼ��������Ϣ�أ��Ȱѳ��м����Ϣ�����ó�һ��
    //�������ó�InitPhrm�����óɶ��ٶԽ��Ӱ�첻��̫�󣬶��㷨�����ٶ���ЩӰ��
    for (int i=0;i<dcitynum;i++)
    {
        for (int j=0;j<dcitynum;j++)
        {
            Phrm[i][j]=InitPhrm;
        }
    }

}


//���»�����Ϣ��
void CDistribution::UpdatePhrm()
{
    //��ʱ���飬�����ֻ�������������м������µ���Ϣ��
    double dbTempAry[dcity.size()][dcity.size()];
    memset(dbTempAry,0,sizeof(dbTempAry)); //��ȫ������Ϊ0

    //���������ӵ���Ϣ��,���浽��ʱ������
    int m=0;
    int n=0;
    for (int i=0;i<n_ant;i++) //����ÿֻ�������µ���Ϣ��
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
    //���»�����Ϣ��
    for (int i=0;i<dcity.size();i++)
    {
        for (int j=0;j<dcity.size();j++)
        {
            Phrm[i][j]=Phrm[i][j]*ROU+dbTempAry[i][j]; //���µĻ�����Ϣ�� = �������Ϣ�� + �����µ���Ϣ��
        }
    }

}


void CDistribution::Search(Truck& truck)
{

    //�ڵ��������ڽ���ѭ��
    int dcitysize=dcity.size();
    for (int i=0;i<n_iterator;i++)
    {
        //ÿֻ��������һ��
        for (int j=0;j<n_ant;j++)
        {
            vector<City> citytemp;
            for(int q=0;q<dcitysize;q++)
                citytemp.push_back(dcity[q]);

            m_cAntAry[j].Search(citytemp,truck,Phrm,Distance);
        }

        //������ѽ��
        for (int j=0;j<n_ant;j++)
        {
            if (m_cAntAry[j].m_dbPathLength < m_cBestAnt.m_dbPathLength)
            {
                m_cBestAnt=m_cAntAry[j];
            }
        }


        //���»�����Ϣ��
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
        //������Ϣ����
        n_source=root["sourcelist"].size();
        n_target=root["targetlist"].size();
        citynum=n_source+n_target;
        City c[citynum];
        for(int i=0;i<n_source;i++)
        {
            //��ϳ�����name
            char temp[10];//������ϳ���������
            int num=i+1;  //�������ֵ���Ų���
            temp[0]='m';
            itoa(num,&temp[1],10);
            strcpy(c[i].name,temp);

            c[i].x=root["sourcelist"][i]["x"].asInt();
            c[i].y=root["sourcelist"][i]["y"].asInt();
            c[i].num=root["sourcelist"][i]["num"].asInt();
        }
        for(int i=n_source;i<citynum;i++)
        {
             //��ϳ�����name
            char temp[10];//������ϳ���������
            int num=i-n_source+1;  //�������ֵ���Ų���
            temp[0]='n';
            itoa(num,&temp[1],10);
            strcpy(c[i].name,temp);

            c[i].x=root["targetlist"][i-n_source]["x"].asInt();
            c[i].y=root["targetlist"][i-n_source]["y"].asInt();
            c[i].num=-root["targetlist"][i-n_source]["num"].asInt();//�����numΪ����
        }

        for(int i=0;i<citynum;i++)
            city.push_back(c[i]);
        cout<<"��JSON����ĳ����������£�"<<endl;
        cout<<"source_num = "<<n_source<<"  target_num = "<<n_target<<endl<<endl;
        for(int i=0;i<citynum;i++)
            cout<<city[i];

        //JSON���뿨����������������
        DistrSize=root["trucklist"].size();
        for(int i=0;i<DistrSize;i++)
        {
            Distr[i].truck.truckid=i+1;
            Distr[i].truck.capacity=0;
            Distr[i].truck.x=root["trucklist"][i]["x"].asInt();
            Distr[i].truck.y=root["trucklist"][i]["y"].asInt();
            Distr[i].truck.maxcapacity=root["trucklist"][i]["capacity"].asInt();
        }

        cout<<"��JSON����Ŀ����������£�"<<endl;
        cout<<"DistrSize(truck_num)= "<<DistrSize<<endl;
        for(int i=0;i<DistrSize;i++)
            cout<<Distr[i].truck;
    }

}



//����������飬��ͳ�Ƹ�����ĳ�������
void CreatGroup( int citygroup[][n_city],int citygroupnum[])
{

    for(int i=0;i<n_source;i++)
        city[i].group=-1;
    for(int i=n_source;i<citynum;i++)
        city[i].group=rand()%DistrSize;

        int pointer[DistrSize];
        memset(pointer,0,sizeof(pointer));
        //ͳ�Ƹ����еķ������
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
    //�������ط�����Ϣ
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
    //�ж��Ƿ����û������صķ���
    for(int i=0;i<DistrSize;i++)
    {
        if(citygroupnum[i]<n_supportnum+1)
            return true;
    }
    return false;
}

bool JudgeRandNo(int na_RandNo[],int **na_PastRandNo,int* n_PastRandNoNum)
{

            bool flag=false;//Ĭ�����ɵ��������δ��ʹ�ù�
            //������ɵ���������Ƿ�ʹ�ù�
            if( (*n_PastRandNoNum) ==0)flag=false;
            else
            for(int i=0;i< (*n_PastRandNoNum) ;i++)
            {
                bool f=true;//���Ƚϵ���������һģһ��
                for(int j=0;j<DistrSize;j++)
                {
                    if(na_RandNo[j]!= *((int*)na_PastRandNo+i*DistrSize+j) )
                    {
                        f=false;//���ֲ���ͬ��ʱ��ֱ��������һ�����м��
                        break;
                    }
                }
                if(f==true)
                {
                    flag=true;
                    break;
                }
            }

            if(flag==true)return true;//�������Ѿ���ʹ�ù���ֱ�ӽ�����һ�εĵ����������

            else//������û�б�ʹ�ù�����¼�����У����� �����е�����+1
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
            //����ģ�͸���
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

            }//����ģ�͸���end
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
//����bestcitygroup�ļ�¼��dcity��ֵ
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


void STDPrint(CDistribution Distr[],int bestcitygroup[][n_city])//��Ļ���
{//����������ʾ��
    cout<<endl<<"STDPrint start..."<<endl;
 //���������Ϣ
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

    for(int i=0;i<DistrSize;i++)//һ�����ÿ��Distrbution�п�����·����Ϣ
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
    cout<<"The total length of all the trucks is ��"<<totallen<<"��"<<endl;
    cout<<"The least time to finish all the distribution works is ��"<<mxlen<<"/speed��"<<endl;

    cout<<endl<<"STDPrint end..."<<endl;
}

void FilePrint(CDistribution Distr[], double Trun)//�ļ����
{
//������json���ļ�
    cout<<endl<<"FilePrint start..."<<endl;


    for(int i=0;i<DistrSize;i++)//ÿ���ӵ����������ϵ���ϸ·����Ϊ�����ʽ������ѹ�뿨����
    {
        cout<<"i="<<i<<endl;
        cout<<"Distr[i].m_cBestAnt.path.size()="<<Distr[i].m_cBestAnt.path.size()<<endl;
        Distr[i].m_cBestAnt.Pathchange();
        cout<<"Pathchange  ok ..."<<endl;
        for(int j=0;j<Distr[i].m_cBestAnt.path.size();j++)
            Distr[i].truck.path.push_back(Distr[i].m_cBestAnt.path[j]);
    }

    cout<<"all path change ok ..."<<endl;


    //��ϸ·�����
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

    bool flag=false;//�����ͷ����

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

    //��·�����
    out<<","<<endl;
    out<<"\"pathlist\":"<<endl;
    out<<"["<<endl;

    //������·���ṹ
    flag=false; //�����ͷ����
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
//��¼��ʼ���е�ʱ��
    int Tstart=clock();
//�õ�ǰʱ����ʼ��������ӣ���ֹÿ�����еĽ������ͬ
    srand(time(NULL));

//��ʹ��json������������г�ʼ��������
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

//�½�������Ϻͽ�������������ս��,����shortestPathLen��¼����·�����ȣ���Ϊ�Ƚ����ӿ��Ƿ���Ҫ��¼�˴�����
    CAnt resultAnt[DistrSize];
    Truck resultTruck[DistrSize];
    double shortestPathLen=DB_MAX;

//ѭ��ִ�� ����  ����  ������ȡ���Ż�����
    for(int it=0;it<n_iter_group;it++)
    {

        int citygroup[DistrSize][n_city];
    //�������
        CreatGroup(citygroup,citygroupnum);
    //�ж��Ƿ����  û������� �ķ���
        if( JudgeNoDemander(citygroupnum,n_source) )continue;

///system("pause");


//���Ƴ���ģ�ͣ���ʼ������������У�����ѭ��iter����ȡ����·��
        int na_PastRandNo[n_iter_randNo][DistrSize];//�洢�Ѿ�ʹ�ù����������
        int n_PastRandNoNum=0;
//�����������������ʱ���������ɵ���������Ѿ�ʹ�ù���
//���������ɣ�ֱ������һ��û��ʹ�ù�������Ϊֹ
        bool flag_updata=false;//�˷����Ƿ���Ը������Ž�
        for(int iter=0;iter<n_iter_randNo;iter++)
        {

            //�����ӵ���������������
            int na_RandNo[DistrSize];
            CreatRandNo(na_RandNo);


//&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&
          if( JudgeRandNo(na_RandNo,(int**)na_PastRandNo,&n_PastRandNoNum) )continue;

//&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&
/*
            //����������
            cout<<endl<<"na_RandNo is :"<<endl;
            for(int i=0;i<DistrSize;i++)
            {
                cout<<na_RandNo[i]<<" ";
            }
            cout<<endl;
*/
            //���Ƴ���ģ��
            vector<City> citytmp;
            for(int i=0;i<city.size();i++)
                citytmp.push_back(city[i]);

/*
            //������и���ģ����Ϣ
            cout<<"--------citytmp----------"<<endl;
            for(int i=0;i<citytmp.size();i++)
                cout<<citytmp[i];
           cout<<"-------------------"<<endl;

*/


            bool flag_break=false;
            //���������������ִ���ӵ�������
            for(int i=0;i<DistrSize;i++)
            {

                vector<City>().swap(Distr[ na_RandNo[i] ].dcity);
                //�ӵ��������г��з���
                for(int j=0;j<citygroupnum[ na_RandNo[i] ];j++)
                    Distr[na_RandNo[i]].dcity.push_back(citytmp[ citygroup[ na_RandNo[i]  ][j] ]);
                //���������
/*
                cout<<"sub-task "<<na_RandNo[i]<<" dcities:"<<endl;
                for(int j=0;j<Distr[ na_RandNo[i] ].dcity.size();j++)
                {
                    cout<<Distr[ na_RandNo[i] ].dcity[j];
                }
///system("pause");
*/
                //��ʼ��
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

                //����
                Distr[ na_RandNo[i] ].Search(Distr[ na_RandNo[i] ].truck);
  ///              cout<<endl<<"Distr["<<na_RandNo[i]<<"].Search() has been ended..."<<endl;

                //���³���ģ�ͣ���������º�ĳ�����Ϣ
                UpdateCityModel(citytmp,Distr[ na_RandNo[i] ]);

///system("pause");
            }//��������ִ��������end
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

            //���㱾�ε����·�������ж��Ƿ���Ҫ���½��
            double shortPathlen=0;
            for(int i=0;i<DistrSize;i++)
            {
                if(Distr[i].truck.pathlen>shortPathlen)
                    shortPathlen=Distr[i].truck.pathlen;
            }
 ///           cout<<endl<<"shortPathLen = "<<shortPathlen<<endl;
///system("pause");
            if( (flag_updata==false) &&( shortPathlen>shortestPathLen*2) )//���η���ı������������е�������ʱ��
            {
                c_skipgroup++;
                break;
            }
            if(shortPathlen<shortestPathLen)//�µ����Ž⣬���½�����ϺͿ���
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

        }//������·��end for(int it=0;it<n_iter_randNo;it++)

    }//����ط���ѭ�� for(int it=0;it<n_iter_group;it++)


   //����bestcitygroup�ļ�¼��dcity��ֵ
    ChangeDcity(Distr,bestcitygroup);


//��������ϺͿ�����ֵ��Distribution����������ϺͿ�������Ϊ���ս��ִ�����
    for(int i=0;i<DistrSize;i++)
    {
        Distr[i].m_cBestAnt=resultAnt[i];
        Distr[i].truck=resultTruck[i];
    }

//ʱ�����
    int Tend=clock();
    double Trun=Tend-Tstart;
    Trun=Trun/=1000;

//////*********���������ϣ���ʼ���*********************////////
    cout<<endl<<"The Running time is "<<Trun<<" s"<<endl;

//������json���ļ�
    FilePrint(Distr,Trun);
//����������ʾ��
    STDPrint(Distr,bestcitygroup);
    cout<<"c_skipgroup="<<c_skipgroup<<endl;
    cout<<"c_update="<<c_update<<endl;
    cout<<"c_nofinish="<<c_nofinish<<endl;
    cout<<"choose error index = "<<c_chooseerror*1.0/c_choosecity<<endl;

    return 0;
}


