from django.shortcuts import render
from django.http import HttpResponse,Http404,JsonResponse
from django import template
from django.template import RequestContext
from vrp.email import *
from vrp.models import Record

import json
import os
import math
import MySQLdb

avg = 0

# Create your views here.

def car(request):
	fp = open('/var/www/mysite/vrp/3.1.html')
	t = template.Template(fp.read())
	fp.close()
	html = t.render(template.Context())
	return HttpResponse(html)

def rank(request):
	fp = open('/var/www/mysite/vrp/rank.html')
	t = template.Template(fp.read())
	fp.close()
	html = t.render(template.Context())
	return HttpResponse(html)

def link(request):
	fp = open('/var/www/mysite/vrp/link.html')
	t = template.Template(fp.read())
	fp.close()
	html = t.render(template.Context())
	return HttpResponse(html)

def receivejsongenetic(request):
	global avg
	#global idname
	if request.method == "POST":
		jsondata = request.POST['jsonstr_']
		datadata1 = request.POST['data1']
		fp4 = open('/var/www/mysite/vrp/static/datascale.txt','w')
		fp4.write(datadata1)
		fp4.close()
		address = request.POST['email_']
		algorithmname = "genetic"
		getdata = datadata1.split()
		mnum = int(getdata[0])
		nnum = int(getdata[1])
		tnum = int(getdata[2])
		
		mcity = [([0]*2) for i in range(mnum)]
		ncity = [([0]*2) for i in range(nnum)]
		
		fp = open('/var/www/mysite/vrp/static/inputjson.txt', 'w')
		fp.write(jsondata)
		fp.close()
		fp3 = open('/var/www/mysite/vrp/static/inputjson.txt','r')
		city = json.load(fp3)
		for m in range(0,mnum):
			mcity[m][0] = city['sourcelist'][m]['x']
			mcity[m][1] = city['sourcelist'][m]['y']
		for n in range(0,nnum):
			ncity[n][0] = city['targetlist'][n]['x']
			ncity[n][1] = city['targetlist'][n]['y']
		fp3.close()
		time = request.POST['time_']
		sum = 0
		ti = int(time)
		arr = []
		pathlengtharr = []
		pathsum = 0
		for i in range(1,ti+1):
			fname = 'outputjson_' + str(i) + '.txt' 
			temp = open('/var/www/mysite/vrp/static/temp.txt', 'w')
			temp.write(fname)
			temp.close()
			os.system("python /var/www/mysite/vrp/static/genetic.py")
			

			fp1 = open('/var/www/mysite/'+fname, 'r')
			t = json.load(fp1)
			times = t['time']
			arr.append(times)
			sum += times
			path = []
			pathlenarr = []
			for a in range(tnum):
				path.append(0)
			for truck in range(0,tnum):
				path[truck] = t['pathlist'][truck]['path']
				for tr in range(1,len(path[truck])):
					splitstr = ' '.join(path[truck][tr])
					splitnum = splitstr.split()
					if splitnum[0] == 'm':
						if len(splitnum) < 3:
							path[truck][tr] = mcity[int(splitnum[1])-1]
						else:
							path[truck][tr] = mcity[int(splitnum[1])*10+int(splitnum[2])-1]
					else:
						if len(splitnum) < 3:
							path[truck][tr] = ncity[int(splitnum[1])-1]
						else:
							path[truck][tr] = ncity[int(splitnum[1])*10+int(splitnum[2])-1]
				pathlen = 0
				for tre in range(0,len(path[truck])-1):
					pathlen += math.sqrt(((path[truck][tre+1][0]-path[truck][tre][0])*(path[truck][tre+1][0]-path[truck][tre][0]))+((path[truck][tre+1][1]-path[truck][tre][1])*(path[truck][tre+1][1]-path[truck][tre][1])))
				pathlenarr.append(pathlen)
			pathlenlong = pathlenarr.index(max(pathlenarr))
			pathlengtharr.append(pathlenarr[pathlenlong])
			pathsum += pathlenarr[pathlenlong]
			fp1.close()

			Record.objects.create(data=datadata1,algorithm="genetic",language="python",time=times,pathlength=pathlenarr[pathlenlong],inputjson=jsondata,outputjson=t)
		avg = sum / ti
		pathavg = pathsum / ti
		pathoptimum = pathlengtharr.index(min(pathlengtharr))
		pathoptimumback = pathoptimum+1
		optimes = pathlengtharr.count(pathlengtharr[pathoptimum])
		#answer = arr.index(min(arr))
		#answering = answer+1
		jsonname = 'outputjson_' + str(pathoptimumback) + '.txt'
		#fp1 = open('/var/www/mysite/'+jsonname,'r')
		#r = json.load(fp1)
		#route = r['pathlist']
		#fp1.close()
		fp2 = open('/var/www/mysite/'+jsonname,'r')
		geneticoutputdata = fp2.read()
		fp2.close()
		fp5 = open('/var/www/mysite/vrp/static/linkoutputjson.txt','w')
		fp5.write(geneticoutputdata)
		#con = MySQLdb.connect(host="127.0.0.1", user="root", passwd="password",db="vrpdatabase",port=3306)
        #cur = con.cursor()
        #cur.execute("SELECT max(id) from vrp_record")
        #idarr = cur.fetchone()
        #con.close()
        #idname = idarr[0]

		send_mail(address,datadata1,pathavg,pathlengtharr[pathoptimum],optimes,time,avg)
		return JsonResponse({'status': 'success', 'geneticmsg': geneticoutputdata})

	return JsonResponse({'status': 'error'})

def receivejsonclustering(request):
	global avg
	#global idname
	if request.method == "POST":
		jsondata = request.POST['jsonstr_']
		datadata2 = request.POST['data2']
		fp4 = open('/var/www/mysite/vrp/static/datascale.txt','w')
		fp4.write(datadata2)
		fp4.close()
		address = request.POST['email_']
		algorithmname = "clustering"
		getdata = datadata2.split()
		mnum = int(getdata[0])
		nnum = int(getdata[1])
		tnum = int(getdata[2])
		mcity = [([0]*2) for i in range(mnum)]
		ncity = [([0]*2) for i in range(nnum)]
		
		fp = open('/var/www/mysite/vrp/static/inputjson.txt', 'w')
		fp.write(jsondata)
		fp.close()
		fp3 = open('/var/www/mysite/vrp/static/inputjson.txt','r')
		city = json.load(fp3)
		for m in range(0,mnum):
			mcity[m][0] = city['sourcelist'][m]['x']
			mcity[m][1] = city['sourcelist'][m]['y']
		for n in range(0,nnum):
			ncity[n][0] = city['targetlist'][n]['x']
			ncity[n][1] = city['targetlist'][n]['y']
		fp3.close()
		time = request.POST['time_']
		sum = 0
		ti = int(time)
		arr = []
		pathlengtharr = []
		pathsum = 0
		for i in range(1,ti+1):
			fname = 'outputjson_' + str(i) + '.txt' 
			temp = open('/var/www/mysite/vrp/static/temp.txt', 'w+')
			temp.write(fname)
			temp.close()
			os.system("python /var/www/mysite/vrp/static/clustering.py")
			

			fp1 = open('/var/www/mysite/'+fname, 'r')
			t = json.load(fp1)
			times = t['time']
			arr.append(times)
			sum += times
			path = []
			pathlenarr = []
			for a in range(tnum):
				path.append(0)
			for truck in range(0,tnum):
				path[truck] = t['pathlist'][truck]['path']
				for tr in range(1,len(path[truck])):
					splitstr = ' '.join(path[truck][tr])
					splitnum = splitstr.split()
					if splitnum[0] == 'm':
						if len(splitnum) < 3:
							path[truck][tr] = mcity[int(splitnum[1])-1]
						else:
							path[truck][tr] = mcity[int(splitnum[1])*10+int(splitnum[2])-1]
					else:
						if len(splitnum) < 3:
							path[truck][tr] = ncity[int(splitnum[1])-1]
						else:
							path[truck][tr] = ncity[int(splitnum[1])*10+int(splitnum[2])-1]
				pathlen = 0
				for tre in range(0,len(path[truck])-1):
					pathlen += math.sqrt(((path[truck][tre+1][0]-path[truck][tre][0])*(path[truck][tre+1][0]-path[truck][tre][0]))+((path[truck][tre+1][1]-path[truck][tre][1])*(path[truck][tre+1][1]-path[truck][tre][1])))
				pathlenarr.append(pathlen)
			pathlenlong = pathlenarr.index(max(pathlenarr))
			pathlengtharr.append(pathlenarr[pathlenlong])
			pathsum += pathlenarr[pathlenlong]
			fp1.close()

			Record.objects.create(data=datadata2,algorithm="clustering",language="python",time=times,pathlength=pathlenarr[pathlenlong],inputjson=jsondata,outputjson=t)
		avg = sum / ti
		pathavg = pathsum / ti
		pathoptimum = pathlengtharr.index(min(pathlengtharr))
		pathoptimumback = pathoptimum+1
		optimes = pathlengtharr.count(pathlengtharr[pathoptimum])
		#answer = arr.index(min(arr))
		#answering = answer+1
		jsonname = 'outputjson_' + str(pathoptimumback) + '.txt'
		#fp1 = open('/var/www/mysite/'+jsonname,'r')
		#r = json.load(fp1)
		#route = r['pathlist']
		#fp1.close()
		fp2 = open('/var/www/mysite/'+jsonname,'r')
		clusteringoutputdata = fp2.read()
		fp2.close()
		fp5 = open('/var/www/mysite/vrp/static/linkoutputjson.txt','w')
		fp5.write(clusteringoutputdata)
		#con = MySQLdb.connect(host="127.0.0.1", user="root", passwd="password",db="vrpdatabase",port=3306)
        #cur = con.cursor()
        #cur.execute("SELECT max(id) from vrp_record")
        #idarr = cur.fetchone()
        #con.close()
        #idname = idarr[0]

		send_mail(address,datadata2,pathavg,pathlengtharr[pathoptimum],optimes,time,avg)
		return JsonResponse({'status': 'success', 'clusteringmsg': clusteringoutputdata})

	return JsonResponse({'status': 'error'})	



def receivejsonant(request):
	global avg
	#global idname
	if request.method == "POST":
		jsondata = request.POST['jsonstr_']
		datadata3 = request.POST['data3']
		fp4 = open('/var/www/mysite/vrp/static/datascale.txt','w')
		fp4.write(datadata3)
		fp4.close()
		address = request.POST['email_']
		algorithmname = "ant colony"
		getdata = datadata3.split()
		mnum = int(getdata[0])
		nnum = int(getdata[1])
		tnum = int(getdata[2])
		mcity = [([0]*2) for i in range(mnum)]
		ncity = [([0]*2) for i in range(nnum)]
		
		fp = open('/var/www/mysite/vrp/static/inputjson.txt', 'w')
		fp.write(jsondata)
		fp.close()
		fp3 = open('/var/www/mysite/vrp/static/inputjson.txt','r')
		city = json.load(fp3)
		for m in range(0,mnum):
			mcity[m][0] = city['sourcelist'][m]['x']
			mcity[m][1] = city['sourcelist'][m]['y']
		for n in range(0,nnum):
			ncity[n][0] = city['targetlist'][n]['x']
			ncity[n][1] = city['targetlist'][n]['y']
		fp3.close()
		time = request.POST['time_']
		sum = 0
		ti = int(time)
		arr = []
		pathlengtharr = []
		pathsum = 0
		for i in range(1,ti+1):
			fname = 'outputjson_' + str(i) + '.txt' 
			temp = open('/var/www/mysite/vrp/static/temp.txt', 'w+')
			temp.write(fname)
			temp.close()
			os.system("python /var/www/mysite/vrp/static/ant.py")
			

			fp1 = open('/var/www/mysite/'+fname, 'r')
			t = json.load(fp1)
			times = t['time']
			arr.append(times)
			sum += times
			path = []
			pathlenarr = []
			for a in range(tnum):
				path.append(0)
			for truck in range(0,tnum):
				path[truck] = t['pathlist'][truck]['path']
				for tr in range(1,len(path[truck])):
					splitstr = ' '.join(path[truck][tr])
					splitnum = splitstr.split()
					if splitnum[0] == 'm':
						if len(splitnum) < 3:
							path[truck][tr] = mcity[int(splitnum[1])-1]
						else:
							path[truck][tr] = mcity[int(splitnum[1])*10+int(splitnum[2])-1]
					else:
						if len(splitnum) < 3:
							path[truck][tr] = ncity[int(splitnum[1])-1]
						else:
							path[truck][tr] = ncity[int(splitnum[1])*10+int(splitnum[2])-1]
				pathlen = 0
				for tre in range(0,len(path[truck])-1):
					pathlen += math.sqrt(((path[truck][tre+1][0]-path[truck][tre][0])*(path[truck][tre+1][0]-path[truck][tre][0]))+((path[truck][tre+1][1]-path[truck][tre][1])*(path[truck][tre+1][1]-path[truck][tre][1])))
				pathlenarr.append(pathlen)
			pathlenlong = pathlenarr.index(max(pathlenarr))
			pathlengtharr.append(pathlenarr[pathlenlong])
			pathsum += pathlenarr[pathlenlong]
			fp1.close()

			Record.objects.create(data=datadata3,algorithm="ant colony",language="python",time=times,pathlength=pathlenarr[pathlenlong],inputjson=jsondata,outputjson=t)
		avg = sum / ti
		pathavg = pathsum / ti
		pathoptimum = pathlengtharr.index(min(pathlengtharr))
		pathoptimumback = pathoptimum+1
		optimes = pathlengtharr.count(pathlengtharr[pathoptimum])
		#answer = arr.index(min(arr))
		#answering = answer+1
		jsonname = 'outputjson_' + str(pathoptimumback) + '.txt'
		#fp1 = open('/var/www/mysite/'+jsonname,'r')
		#r = json.load(fp1)
		#route = r['pathlist']
		#fp1.close()
		fp2 = open('/var/www/mysite/'+jsonname,'r')
		antoutputdata = fp2.read()
		fp2.close()
		fp5 = open('/var/www/mysite/vrp/static/linkoutputjson.txt','w')
		fp5.write(antoutputdata)
		#con = MySQLdb.connect(host="127.0.0.1", user="root", passwd="password",db="vrpdatabase",port=3306)
        #cur = con.cursor()
        #cur.execute("SELECT max(id) from vrp_record")
        #idarr = cur.fetchone()
        #con.close()
        #idname = idarr[0]

		send_mail(address,datadata3,pathavg,pathlengtharr[pathoptimum],optimes,time,avg)
		return JsonResponse({'status': 'success', 'antmsg': antoutputdata})

	return JsonResponse({'status': 'error'})
	

def linkdata(request):
	if request.method == "POST":
		fp1 = open('/var/www/mysite/vrp/static/datascale.txt','r')
		datascaleback = fp1.read()
		fp1.close()
		fp2 = open('/var/www/mysite/vrp/static/linkoutputjson.txt','r')
		linkoutputback = fp2.read()
		fp2.close()
		return JsonResponse({'status': 'success', 'datascalebackmsg': datascaleback,'linkoutputbackmsg': linkoutputback})
	return JsonResponse({'status': 'error'})

def rankruntime1(request):
	if request.method == "POST":
		con = MySQLdb.connect(host="127.0.0.1", user="root", passwd="password",db="vrpdatabase",port=3306)
		cur = con.cursor()
		cur.execute("select * from vrp_record where data='3 3 2' order by 0+time asc")
		ranktopruntime1 = cur.fetchall()
		con.close()
		return JsonResponse({'status': 'success', 'rankruntimemsg1': ranktopruntime1})
	return JsonResponse({'status': 'error'})

def rankruntime2(request):
	if request.method == "POST":
		con = MySQLdb.connect(host="127.0.0.1", user="root", passwd="password",db="vrpdatabase",port=3306)
		cur = con.cursor()
		cur.execute("select * from vrp_record where data='5 5 3' order by cast(time as decimal(9,4)) asc")
		ranktopruntime2 = cur.fetchall()
		con.close()
		return JsonResponse({'status': 'success', 'rankruntimemsg2': ranktopruntime2})
	return JsonResponse({'status': 'error'})

def rankruntime3(request):
	if request.method == "POST":
		con = MySQLdb.connect(host="127.0.0.1", user="root", passwd="password",db="vrpdatabase",port=3306)
		cur = con.cursor()
		cur.execute("select * from vrp_record where data='8 8 4' order by cast(time as decimal(9,4)) asc")
		ranktopruntime3 = cur.fetchall()
		con.close()
		return JsonResponse({'status': 'success', 'rankruntimemsg3': ranktopruntime3})
	return JsonResponse({'status': 'error'})

def rankruntime4(request):
	if request.method == "POST":
		con = MySQLdb.connect(host="127.0.0.1", user="root", passwd="password",db="vrpdatabase",port=3306)
		cur = con.cursor()
		cur.execute("select * from vrp_record where data='10 10 5' order by cast(time as decimal(9,4)) asc")
		ranktopruntime4 = cur.fetchall()
		con.close()
		return JsonResponse({'status': 'success', 'rankruntimemsg4': ranktopruntime4})
	return JsonResponse({'status': 'error'})

def rankruntime5(request):
	if request.method == "POST":
		con = MySQLdb.connect(host="127.0.0.1", user="root", passwd="password",db="vrpdatabase",port=3306)
		cur = con.cursor()
		cur.execute("select * from vrp_record where data='20 20 10' order by cast(time as decimal(9,4)) asc")
		ranktopruntime5 = cur.fetchall()
		con.close()
		return JsonResponse({'status': 'success', 'rankruntimemsg5': ranktopruntime5})
	return JsonResponse({'status': 'error'})

def rankruntime6(request):
	if request.method == "POST":
		con = MySQLdb.connect(host="127.0.0.1", user="root", passwd="password",db="vrpdatabase",port=3306)
		cur = con.cursor()
		cur.execute("select * from vrp_record where data='25 25 15' order by cast(time as decimal(9,4)) asc")
		ranktopruntime6 = cur.fetchall()
		con.close()
		return JsonResponse({'status': 'success', 'rankruntimemsg6': ranktopruntime6})
	return JsonResponse({'status': 'error'})

def rankruntime7(request):
	if request.method == "POST":
		con = MySQLdb.connect(host="127.0.0.1", user="root", passwd="password",db="vrpdatabase",port=3306)
		cur = con.cursor()
		cur.execute("select * from vrp_record where data='30 30 20' order by cast(time as decimal(9,4)) asc")
		ranktopruntime7 = cur.fetchall()
		con.close()
		return JsonResponse({'status': 'success', 'rankruntimemsg7': ranktopruntime7})
	return JsonResponse({'status': 'error'})

def rankpathlen1(request):
	if request.method == "POST":
		con = MySQLdb.connect(host="127.0.0.1", user="root", passwd="password",db="vrpdatabase",port=3306)
		cur = con.cursor()
		cur.execute("select * from vrp_record where data='3 3 2' order by cast(pathlength as decimal(9,4)) asc")
		ranktoppathlen1 = cur.fetchall()
		con.close()
		return JsonResponse({'status': 'success', 'rankpathlenmsg1': ranktoppathlen1})
	return JsonResponse({'status': 'error'})

def rankpathlen2(request):
	if request.method == "POST":
		con = MySQLdb.connect(host="127.0.0.1", user="root", passwd="password",db="vrpdatabase",port=3306)
		cur = con.cursor()
		cur.execute("select * from vrp_record where data='5 5 3' order by cast(pathlength as decimal(9,4)) asc")
		ranktoppathlen2 = cur.fetchall()
		con.close()
		return JsonResponse({'status': 'success', 'rankpathlenmsg2': ranktoppathlen2})
	return JsonResponse({'status': 'error'})

def rankpathlen3(request):
	if request.method == "POST":
		con = MySQLdb.connect(host="127.0.0.1", user="root", passwd="password",db="vrpdatabase",port=3306)
		cur = con.cursor()
		cur.execute("select * from vrp_record where data='8 8 4' order by cast(pathlength as decimal(9,4)) asc")
		ranktoppathlen3 = cur.fetchall()
		con.close()
		return JsonResponse({'status': 'success', 'rankpathlenmsg3': ranktoppathlen3})
	return JsonResponse({'status': 'error'})

def rankpathlen4(request):
	if request.method == "POST":
		con = MySQLdb.connect(host="127.0.0.1", user="root", passwd="password",db="vrpdatabase",port=3306)
		cur = con.cursor()
		cur.execute("select * from vrp_record where data='10 10 5' order by cast(pathlength as decimal(9,4)) asc")
		ranktoppathlen4 = cur.fetchall()
		con.close()
		return JsonResponse({'status': 'success', 'rankpathlenmsg4': ranktoppathlen4})
	return JsonResponse({'status': 'error'})

def rankpathlen5(request):
	if request.method == "POST":
		con = MySQLdb.connect(host="127.0.0.1", user="root", passwd="password",db="vrpdatabase",port=3306)
		cur = con.cursor()
		cur.execute("select * from vrp_record where data='20 20 10' order by cast(pathlength as decimal(9,4)) asc")
		ranktoppathlen5 = cur.fetchall()
		con.close()
		return JsonResponse({'status': 'success', 'rankpathlenmsg5': ranktoppathlen5})
	return JsonResponse({'status': 'error'})

def rankpathlen6(request):
	if request.method == "POST":
		con = MySQLdb.connect(host="127.0.0.1", user="root", passwd="password",db="vrpdatabase",port=3306)
		cur = con.cursor()
		cur.execute("select * from vrp_record where data='25 25 15' order by cast(pathlength as decimal(9,4)) asc")
		ranktoppathlen6 = cur.fetchall()
		con.close()
		return JsonResponse({'status': 'success', 'rankpathlenmsg6': ranktoppathlen6})
	return JsonResponse({'status': 'error'})

def rankpathlen7(request):
	if request.method == "POST":
		con = MySQLdb.connect(host="127.0.0.1", user="root", passwd="password",db="vrpdatabase",port=3306)
		cur = con.cursor()
		cur.execute("select * from vrp_record where data='30 30 20' order by cast(pathlength as decimal(9,4)) asc")
		ranktoppathlen7 = cur.fetchall()
		con.close()
		return JsonResponse({'status': 'success', 'rankpathlenmsg7': ranktoppathlen7})
	return JsonResponse({'status': 'error'})

def ranknowtime1(request):
	if request.method == "POST":
		con = MySQLdb.connect(host="127.0.0.1", user="root", passwd="password",db="vrpdatabase",port=3306)
		cur = con.cursor()
		cur.execute("select * from vrp_record where data='3 3 2' order by nowtime desc")
		ranktopnowtime1 = cur.fetchall()
		con.close()
		return JsonResponse({'status': 'success', 'ranknowtimemsg1': ranktopnowtime1})
	return JsonResponse({'status': 'error'})

def ranknowtime2(request):
	if request.method == "POST":
		con = MySQLdb.connect(host="127.0.0.1", user="root", passwd="password",db="vrpdatabase",port=3306)
		cur = con.cursor()
		cur.execute("select * from vrp_record where data='5 5 3' order by nowtime desc")
		ranktopnowtime2 = cur.fetchall()
		con.close()
		return JsonResponse({'status': 'success', 'ranknowtimemsg2': ranktopnowtime2})
	return JsonResponse({'status': 'error'})

def ranknowtime3(request):
	if request.method == "POST":
		con = MySQLdb.connect(host="127.0.0.1", user="root", passwd="password",db="vrpdatabase",port=3306)
		cur = con.cursor()
		cur.execute("select * from vrp_record where data='8 8 4' order by nowtime desc")
		ranktopnowtime3 = cur.fetchall()
		con.close()
		return JsonResponse({'status': 'success', 'ranknowtimemsg3': ranktopnowtime3})
	return JsonResponse({'status': 'error'})

def ranknowtime4(request):
	if request.method == "POST":
		con = MySQLdb.connect(host="127.0.0.1", user="root", passwd="password",db="vrpdatabase",port=3306)
		cur = con.cursor()
		cur.execute("select * from vrp_record where data='10 10 5' order by nowtime desc")
		ranktopnowtime4 = cur.fetchall()
		con.close()
		return JsonResponse({'status': 'success', 'ranknowtimemsg4': ranktopnowtime4})
	return JsonResponse({'status': 'error'})

def ranknowtime5(request):
	if request.method == "POST":
		con = MySQLdb.connect(host="127.0.0.1", user="root", passwd="password",db="vrpdatabase",port=3306)
		cur = con.cursor()
		cur.execute("select * from vrp_record where data='20 20 10' order by nowtime desc")
		ranktopnowtime5 = cur.fetchall()
		con.close()
		return JsonResponse({'status': 'success', 'ranknowtimemsg5': ranktopnowtime5})
	return JsonResponse({'status': 'error'})

def ranknowtime6(request):
	if request.method == "POST":
		con = MySQLdb.connect(host="127.0.0.1", user="root", passwd="password",db="vrpdatabase",port=3306)
		cur = con.cursor()
		cur.execute("select * from vrp_record where data='25 25 15' order by nowtime desc")
		ranktopnowtime6 = cur.fetchall()
		con.close()
		return JsonResponse({'status': 'success', 'ranknowtimemsg6': ranktopnowtime6})
	return JsonResponse({'status': 'error'})

def ranknowtime7(request):
	if request.method == "POST":
		con = MySQLdb.connect(host="127.0.0.1", user="root", passwd="password",db="vrpdatabase",port=3306)
		cur = con.cursor()
		cur.execute("select * from vrp_record where data='30 30 20' order by nowtime desc")
		ranktopnowtime7 = cur.fetchall()
		con.close()
		return JsonResponse({'status': 'success', 'ranknowtimemsg7': ranktopnowtime7})
	return JsonResponse({'status': 'error'})
