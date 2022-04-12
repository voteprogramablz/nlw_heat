import axios from "axios";
import prismaClient from "../prisma";
import { sign } from "jsonwebtoken";
/**
 * Receber o code(string) - V
 * Recuperar o access_token no github - V
 * Recuperar infos do user no github - V
 * Verificar se o usuário existe no DB - V
 * ----- SIM = Gera um token
 * ---- NÃO = Cria no DB, gera um token
 * Retornar o token com as infos do user
 */

interface IAccessTokenResponse {
  access_token: string;
}

interface IUserResponse {
  avatar_url: string;
  login: string;
  id: number;
  name: string;
}

class AuthenticateUserService {
  async execute(code: string) {
    const url = "https://github.com/login/oauth/access_token";

    const { data: accessTokenResponse } =
      await axios.post<IAccessTokenResponse>(url, null, {
        params: {
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        },
        headers: {
          Accept: "application/json",
        },
      });

    const response = await axios.get<IUserResponse>(
      "https://api.github.com/user",
      {
        headers: {
          authorization: `Bearer ${accessTokenResponse.access_token}`,
        },
      }
    );

    const { login, avatar_url, id, name } = response.data;

    let user = await prismaClient.user.findFirst({
      where: {
        github_id: id, // name_colum: equal value
      },
    });

    if (!user) {
      await prismaClient.user.create({
        data: {
          github_id: id,
          login,
          avatar_url,
          name,
        },
      });
    }

    const token = sign(
      {
        //primeiro parametro é um payload,
        user: {
          name: user.name,
          avatar_url: user.avatar_url,
          id: user.id,
        },
      },
      process.env.JWT_SECRET, // Uma secret, que serve para criar o token e validar ele
      {
        // subject normalmente é o id do usuario
        subject: user.id,
        expiresIn: "1d",
      }
    );

    return { token, user };
  }
}

export { AuthenticateUserService };
