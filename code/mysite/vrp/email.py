#coding:utf-8

import requests, json

url = "http://www.sendcloud.net/webapi/mail.send_template.json"

API_USER = 'cyq333_test_8vcCNP'
API_KEY = '76883jrpp1doISqE'
#
# email = 'b14040118@njupt.edu.cn'
# timeavearge = 2333
# splendaverage = 66666
def send_mail(email,scale,avlength,optimum,atimes,runtimes,timeavg):
    sub_vars = {
        'to': [email],
        'sub': {
	    '%scale%': [scale],
            '%avlength%': [avlength],
            '%optimum%': [optimum],
	    '%atimes%': [atimes],
        '%runtimes%': [runtimes],
        '%timeavg%': [timeavg],
        }
    }

    params = {
        "api_user": API_USER, # 使用api_user和api_key进行验证
        "api_key" : API_KEY,
        "template_invoke_name": "vrp_send",
        "substitution_vars": json.dumps(sub_vars),
        "from" : "cyq333_test_8vcCNP@8fc0ZGTwQEg5kovx6BuiUw2wcti1KCTI.sendcloud.org", # 发信人, 用正确邮件地址替代
        "fromname" : "vrp",
        "resp_email_id": "true",
    }

    r = requests.post(url, data=params)

