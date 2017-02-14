"""mysite URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/1.10/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  url(r'^$', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  url(r'^$', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.conf.urls import url, include
    2. Add a URL to urlpatterns:  url(r'^blog/', include('blog.urls'))
"""
from django.conf.urls import url
from django.contrib import admin
from vrp import views

urlpatterns = [
    url(r'^admin/', admin.site.urls),
    url(r'rankruntimejson1',views.rankruntime1),
    url(r'rankruntimejson2',views.rankruntime2),
    url(r'rankruntimejson3',views.rankruntime3),
    url(r'rankruntimejson4',views.rankruntime4),
    url(r'rankruntimejson5',views.rankruntime5),
    url(r'rankruntimejson6',views.rankruntime6),
    url(r'rankruntimejson7',views.rankruntime7),
    url(r'rankpathlenjson1',views.rankpathlen1),
    url(r'rankpathlenjson2',views.rankpathlen2),
    url(r'rankpathlenjson3',views.rankpathlen3),
    url(r'rankpathlenjson4',views.rankpathlen4),
    url(r'rankpathlenjson5',views.rankpathlen5),
    url(r'rankpathlenjson6',views.rankpathlen6),
    url(r'rankpathlenjson7',views.rankpathlen7),
    url(r'ranknowtimejson1',views.ranknowtime1),
    url(r'ranknowtimejson2',views.ranknowtime2),
    url(r'ranknowtimejson3',views.ranknowtime3),
    url(r'ranknowtimejson4',views.ranknowtime4),
    url(r'ranknowtimejson5',views.ranknowtime5),
    url(r'ranknowtimejson6',views.ranknowtime6),
    url(r'ranknowtimejson7',views.ranknowtime7),
    url(r'^rank.html/',views.rank),
    url(r'^$',views.car),
    url(r'linkdatajson', views.linkdata),
    url(r'^link',views.link),
    url(r'geneticjson',views.receivejsongenetic),
    url(r'clusteringjson',views.receivejsonclustering),
    url(r'antjson', views.receivejsonant),
]
