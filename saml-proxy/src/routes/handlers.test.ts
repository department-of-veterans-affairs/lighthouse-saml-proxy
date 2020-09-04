import "jest";
import { getHashCode, samlLogin } from "./handlers.js";

describe("getHashCode", () => {
  it("should get hash code for a string", () => {
    expect(getHashCode("test-string")).toEqual(-1666277972);
  });
});

describe("samlLogin", () => {
  let mockResponse;
  let mockRequest;
  let mockNext;

  beforeEach(() => {
    mockResponse = {
      render: jest.fn(),
    };

    mockRequest = {
      sessionID: "sessionID",
      query: {
        acsUrl: "url",
      },
      sp: {
        options: {
          getResponseParams: () => {
            return {
              thumbprint: "thumbprint",
            };
          },
          getAuthnRequestParams: () => {
            return {
              identityProviderUrl: "https://identityProviderUrl.com",
              id_me_login_link:
                "https://api.idmelabs.com/saml/SingleSignOnService?SAMLRequest=fVJNTwIxED37Lza9s13BaGxYAoGYkOBHQD14G8sITfqxdmYR%2F73dZSEc1GQP3c57M%2B%2B96ZDA2UpNat76JX7WSJztnfWk2kIp6uhVADKkPDgkxVqtJvcL1c8LVcXAQQcrzij%2FM4AII5vgRTaflWI8ns%2FG43QmqnHuicFzKfpFv%2BgVt71i8Hx5ra7Sd%2FsmsovJkTsNnmqHcYVxZzS%2BLBel2DJXSkobNNhtIFY3RVHI1kMM%2B29JVfsjiYK4mCWXxkPT68CkRIXK5Gbt0MI75Tq4A35l%2FMbiymz8o%2B%2FmiewVI7XcZElkdyFqbAMsBccaxWjYUFVrKo5OGvIdbMIuX%2BNuKM8Bw8MKHlJY89lTsEZ%2FNz0d8P9ZNjdm3ftooapqNBGjZ5FNrA1f04jA2EmSxyndjnHdCk5JMu45mwZXQTTUeMI9aD56OEdNbdreEj9GXdYpLPCwQZdm5smZ9CQToo7gNaZNgBx0Rn%2Ftcqj9oehUPX%2BYox8%3D&RelayState=%2F&SigAlg=http%3A%2F%2Fwww.w3.org%2F2001%2F04%2Fxmldsig-more%23rsa-sha256&Signature=crqsP27LiAeJpKx7%2Bjshr4OeqHvFnp1rYmkP4rHTYXdEIjp6iIo7Zu3uwzXfkm%2BJp0ShXPAy7R6855y1dMBmOz3eVjdvdm8rQ7%2B044hTw3Cxmcuf836up4rsKLeT4vIHc3%2FA3qtDK3ut%2FXiArNLZJ%2FwOrC6KNWAuhJQ8fZIPv18uiCw1eNBJA2iCUD6KKtI%2FDgwA%2B1MtpRCsHNcpX23XQryIPkH8l6MsRDw1ZM3vttF7UZa6OkIsxFEXFJ4VZMal%2BciNZV%2FiB0%2FK3QvmbbKX8k%2BuJKL8rmIJr0XhNw%2BYLcMTNnpL%2FTQloi0xS18gu3J6GY%2BTEsG1CeJRNHkuJyF3LQ%3D%3D",
              dslogon_login_link:
                "https://api.idmelabs.com/saml/SingleSignOnService?SAMLRequest=fVLLboMwEDznL5DvAZpWrWIFRASqhJQ%2BlLQ99ObCJrFkvNS7pMnfF8hDHNpIPtjeGe%2FMrGekKlPLecNbu4TvBoi9fWUsyb4QicZZiYo0SasqIMmFXM2fFnLih7J2yFigEQPKdYYiAscarfDyLBJJkmdJ0u6JGsgtsbIciUk4CcfhdBzevt3cy7t2TT%2BFN5qfuSlaaipwK3A7XcD7chGJLXMtg8BgocwWieVDGIZB78Hh%2FhBQ3R8CIhSjrHWprereOjKppapa%2B7qswKgv8gusjviVthsDK72xL%2FbUT3gf4KjntpaE94iugD7ASLBrQMSzjip7Uy6%2BaPB3aoM7v4TdLBgCZscRPLdh5dkrGl0cujcrxdez7G50OV73UFl3mojBsvDmxuBP6kAxnCQF5y6nGUPZC26TZNizl2JVK6ep8wR7VfDZwxCVmnZ6S1jHJRncoD25%2BBNyrP3T7lId%2Frr4Fw%3D%3D&RelayState=%2F&SigAlg=http%3A%2F%2Fwww.w3.org%2F2001%2F04%2Fxmldsig-more%23rsa-sha256&Signature=bkKD3IEEtf7GErOTAkv6iYxgQF9UGcg1M%2BrZvuMvRXzaSz9Y2uQSWfsYT7m4x0ZU1JbNYsavwHLxAT%2BjwxcMSriLg4ywT0oa50dMwIlKih9IlUJgRvxHXsDYR8s%2B%2F%2BqH6JZYgCJO%2Fmxbam2UMJTqAn3MkheVXxMTCVNRre5%2FL56Eh8EEsf8j%2F9BqUIMA8kxlCgiOoC08nr0%2FEx6kmBYdvywat4RE7jiFKT1lce3U4t0n28fOu%2BfrQCyvtaRZoIMRGIRWxtLh5CaSU6jn%2Fwvfzei45%2FxWHW5W2noUDjCXbIDr4QMUNl5aePQn5jOVWYeNdkyp4CTq1%2FgyFsXW1k3M3A%3D%3D",
              mvh_login_link:
                "https://api.idmelabs.com/saml/SingleSignOnService?SAMLRequest=fVLLbsIwEDzzF5HvJCmtWmERFERUKRJ9iLQ99OYmC7HkR%2BrdpOHvmwcgDi2SD7Z3xjsz6wUKrSq%2Bqqk0W%2FiuAclrtTLIh0LEame4FSiRG6EBOeU8Wz1t%2BMwPeeUs2dwqdkG5zhCI4Ehaw7w0iVgcp0kcd3vEGlKDJAxFbBbOwmk4n4a3bzf3%2FK5b80%2FmTVYn7toarDW4DFwjc3jfbiJWElU8CJTNhSotEn8IwzAYPDjbHgKshkOAaNkk6VxKI%2Fq3RiZ2VFFJXxYalPhCP7d6xGfS7BVkcm9ezLEf8z7A4cDtLDHv0bochgAjRq4Gtlz0VD6YcsuzBr8Re9v4BTSL4BKwGEfw3IWVJq9WyfzQv6kFXc%2Byv5HFdDdAedVrQgJDzFspZX%2FWDgTBUVJw6nKcMRSD4C5Jgpa8tdWVcBJ7T9CKnE4eLlFr1U1vC7ulPpQgFJXQAB2t%2FIkba%2F%2F0PFcvv97yFw%3D%3D&RelayState=%2F&SigAlg=http%3A%2F%2Fwww.w3.org%2F2001%2F04%2Fxmldsig-more%23rsa-sha256&Signature=AtPbhLpittfvJLCw19J3u8Vq6UvBG7maFggSQM6vCTKCdB%2FAhCXk0P0drEk4OS0RNk2dZ8yVOfTeJ85874Re5VL%2BRKiUDd751U0VhSdlVkz%2Bl%2BeCmK%2FJzq8%2F9G5tgwjJbBk2Z6WBQlSspsfYBUetm%2B77NfI%2BPHjiusVXelk7t6cKAXV81YHyuwCgXaw2Y%2BxeUS8pna5W4zult1V4vE0YLpSyOnQbAeGLXygqmcuSlm%2BR0%2BTZsatYEve%2BubTxCXy58gE8ab3VhSjuasu%2BLiby8kJUpF95Shuhv58YyDYRx%2BtgJ9%2BDBit%2F4vB5MkvhYpDpIYXpYxBPo%2Ftv2fSqmLjU1Q%3D%3D",
            };
          },
        },
      },
      authnRequest: "authnRequest",
      get: (param) => {
        return param;
      },
    };

    mockNext = jest.fn();
  });
  it.skip("Happy Path", async () => {
    samlLogin("login_selection")(mockRequest, mockResponse, mockNext);
    expect(mockResponse.render).toHaveBeenCalled();
  });
});
