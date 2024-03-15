from twilio.rest import Client as TwilioClient

# Documentation: https://www.twilio.com/docs/phone-numbers/api/incomingphonenumber-resource
def get_all_twilio_numbers(twilio_account_sid, twilio_auth_token):
    client = TwilioClient(twilio_account_sid, twilio_auth_token)
    twilio_numbers = client.incoming_phone_numbers.list()

    return twilio_numbers

# Documentation: https://www.twilio.com/docs/phone-numbers/api/incomingphonenumber-resource
def update_twilio_sms_url(old_sms_url, new_sms_url, twilio_account_sid, twilio_auth_token):
    twilio_numbers = get_all_twilio_numbers(twilio_account_sid, twilio_auth_token)

    num_updated = 0
    for twilio_number in twilio_numbers:
        if (twilio_number.sms_url == old_sms_url):
            twilio_number.update(
                sms_url=new_sms_url
            )

            print(f"Updated {twilio_number.phone_number} {twilio_number.friendly_name}")

            num_updated += 1

    if num_updated == 0:
        print('Nothing to update')
    else:
        print()
        print(f'Updated {num_updated} Twilio numbers')