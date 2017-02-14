from django.db import models

# Create your models here.

class Record(models.Model):
    data = models.CharField(max_length=20)
    algorithm = models.CharField(max_length=20)
    language = models.CharField(max_length=20)
    time = models.CharField(max_length=20)
    pathlength = models.CharField(max_length=20)
    nowtime = models.DateTimeField(auto_now=True, auto_now_add=False)
    inputjson = models.CharField(max_length=10000)
    outputjson = models.CharField(max_length=20000)

    def __unicode__(self):
        return self.data
